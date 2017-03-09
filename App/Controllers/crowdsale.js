/**
 * Created by shumer on 2/21/17.
 */
let request = require('request'),
	async = require('async'),
	logger = require('log4js').getLogger('Crowdsale Controller'),
	config = require(ConfigPath),
	moment = require('moment'),
	fx = require("money"),
	ethHelper = require('../Components/eth'),
    changelly = require('../Components/changelly');

fx.base = "USD";

let Controllers = getControllers(),
	Contracts = getContracts(),
	Models = getModels();

class CrowdsaleController {
	
	constructor() {
		this.ratesData = {
			fiat: {},
			crypto: {}
		};
		logger.info('Crowdsale controller initialized');
	}
	
	getTokenPrice() {
		if(!Contracts.crowdsale.amountRaised || Contracts.crowdsale.amountRaised < 2000) {
			return 250;
		} else if(Contracts.crowdsale.amountRaised < 8000) {
			return 150;
		} else {
			return 100;
		}
	}
	
	deposit(callback, data) {
		let {currency} = data._post,
			{_id : userId, address} = data.user;

		if(!currency) {
			return callback('Currency is required');
		}
		
		if(currency.toUpperCase() == 'ETH') {
			return callback(null, {
                address: address,
                type: 'ETH'
            });
		}
		
		async.waterfall([
			(cb) => {
				Models.depositWallets.findOne({
					userId: userId,
					depositType: currency.toUpperCase()
				}, (err, wallet) => {
					cb(null, wallet);
				});
			},
			(wallet, cb) => {
				if(wallet) {
					cb(null, wallet);
				} else {
					CrowdsaleController.createTransactionWallet(currency, userId, address, cb);
				}
			}
		], (err, wallet) => {
			if(err) return GlobalError('20012012', err, callback);

			let response = {
				address: wallet.deposit,
				type: wallet.depositType.toUpperCase()
			};

			switch(response.type) {
				case 'BTS':
					return callback(null, {
						address: wallet.extraInfo,
						memo: wallet.deposit,
						type: wallet.depositType.toUpperCase()
					});
					break;
				case 'XMR':
					return callback(null, {
						address: wallet.extraInfo,
						paymentId: wallet.deposit,
						type: wallet.depositType.toUpperCase()
					});
					break;
                case 'XRP':
                    return callback(null, {
                        address: wallet.deposit,
                        destTag: wallet.extraInfo,
                        type: wallet.depositType.toUpperCase()
                    });
                    break;
				default:
					return callback(null, {
						address: wallet.deposit,
						type: wallet.depositType.toUpperCase()
					});
			}
		});
	}
	
	transactions(callback, data) {
		let userId = data.req.user._id,
			sort = -1;
		
		if(data._get.sort && data._get.sort == 1 || data._get.sort == -1) {
			sort = data._get.sort;
		}
		
		async.waterfall([
			// TODO: support deprecated logic
			cb => {
				Models.depositWallets.find({
					userId: userId,
					executedAt: {$ne: null}
				}, null, {sort: {executedAt: sort}}, (err, wallets) => {
					let transactions = wallets.map((wallet) => {
						return {
							date: moment(wallet.executedAt).format('YYYY-MM-DD HH:mm:ss'),
							sentAmount: parseFloat(wallet.transaction.incomingCoin - (wallet.transaction.maxCommission || 0)),
							sentCoinType: wallet.transaction.incomingType,
							transactionId: wallet.transaction.transaction,
							address: wallet.transaction.withdraw,
							receivedAmount: parseFloat(wallet.transaction.fundAmount),
							rate: parseFloat(wallet.transaction.incomingCoin / wallet.transaction.fundAmount),
							tokenPrice: parseInt(wallet.transaction.tokenPrice) || 250
						};
					});
					
					cb(null, transactions);
				});
			},
			(transactions, cb) => {
				Models.transactions.find({
					userId: userId
				}, (err, list) => {
					list.forEach(Tx => {
						transactions.push({
							date: moment(Tx.createdAt).format('YYYY-MM-DD HH:mm:ss'),
							sentAmount: parseFloat(Tx.amount),
							sentCoinType: Tx.currency,
							transactionId: Tx.txHash,
							address: Tx.address || '',
							receivedAmount: parseFloat(Tx.receivedTokens),
							// rate: parseInt(dwallet.transaction.incomingCoin / wallet.transaction.fundAmount),
							tokenPrice: Tx.currency == 'ETH' ? (parseInt(Tx.tokenPrice) || 250) : parseFloat(Tx.receivedTokens / Tx.amount).toFixed(4)
						});
					});
					return cb(null, transactions);
				});
			}
		], callback);
	}
	
	rates(callback, data) {
		callback(null, Controllers.crowdsale.ratesData);
	}

	exchangeAmount(callback, data){
		let {currency, amount} = data._get;

        if(!currency) {
            return callback('Currency is required');
        }

        if(!amount) {
            return callback('Amount is required');
        }

        async.parallel({
        	min : (cb)=>{
                changelly.getMinAmount(currency, 'eth', function(error, data) {
                    if(error)
                        return cb('Changelly get min amount error: ' + error);

                    if(data.error)
                        return cb('Changelly get min amount error: ' + data.error.message);

                    return cb(null, data.result);
                });
			},
			amount : (cb)=>{
                changelly.getExchangeAmount(currency, 'eth', amount, function(error, data) {
                    if(error)
                        return cb('Changelly get exchange amount error: ' + error);

                    if(data.error)
                        return cb('Changelly get exchange amount error: ' + data.error.message);

                    return cb(null, data.result * Controllers.crowdsale.getTokenPrice());
                });
			}
		}, (error, result)=>{
            if(error) callback(error);

            callback(null, result);
		});
	}
	
	static createTransactionWallet(currency, userId, userAddress, callback) {
		async.waterfall([
			(cb) => {
                CrowdsaleController.requestChangelly(currency, userAddress, cb)
			},
			(response, cb) => {
				let newWallet = {
					userId		: userId,
					orderId		: response.orderId,
					deposit		: response.deposit,
					depositType	: response.coin.toUpperCase(),
					extraInfo	: response.extraInfo,
					executed	: false,
					executedAt	: null
				};

				Models.depositWallets.create(newWallet, err => {
					console.log(err);
					if(err) return cb('Insert deposit wallet error');
					logger.info(`New ${currency} wallet created by user ${userId}`);
					cb(null, newWallet);
				});
			}
		], callback);
		
	}

	static requestShapeShift(currency, userAddress, cb){
		let coin = currency.toLowerCase();

        request({
            method: 'POST',
            uri: 'https://shapeshift.io/shift',
            json: {
                withdrawal: userAddress || config['ethereum']['public_key'],
                pair: `${coin}_eth`,
                // returnAddress:"BBBBBBBBBBB",//TODO return address may be required (!!!important!!!)
                apiKey: config['shapeshift']['public_key']
            }
        }, (error, response, body) => {
            if(error || response.statusCode != 200)
                return cb('Create transaction wallet error: ' + error);

            if(body.error)
                return cb('Api error' + body.error);

            cb(null, {
                coin,
                orderId : body.orderId,
                deposit : body.deposit,
                extraInfo : (coin == 'xmr' || coin == 'bts') ? body.sAddress : null,
            });
        });
	}

	static requestChangelly(currency, userAddress, cb){
        let coin = currency.toLowerCase();

        changelly.generateAddress(coin, 'eth', userAddress, undefined, (error, data) => {
        	if(error)
        		return cb('Create transaction wallet error: ' + error);

        	if(data.error)
        		return cb('Create transaction wallet error: ' + data.error.message);

            cb(null, {
                coin,
                orderId : data.id,
                deposit : data.result.address,
                extraInfo : data.result.extraId ? data.result.extraId : null,
            })
        });
	}
}

Controllers.crowdsale = new CrowdsaleController();