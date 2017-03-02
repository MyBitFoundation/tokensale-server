/**
 * Created by shumer on 2/21/17.
 */
let request = require('request'),
	async = require('async'),
	logger = require('log4js').getLogger('Crowdsale Controller'),
	config = require(ConfigPath),
	moment = require('moment'),
	fx = require("money"),
	ethHelper = require('../Components/eth');

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
			userId = data.req.user._id;
		
		if(!currency) {
			return callback('Currency is required');
		}
		
		if(currency.toUpperCase() == 'ETH') {
			let publicKey = data.req.user.publicKey;
			let address = ethHelper.addressFromPublic(publicKey);
			
			return callback(null, (publicKey && address) ? {
					address: address.slice(2),
					type: 'ETH'
				} : null);
		}
		
		async.waterfall([
			(cb) => {
				Models.depositWallets.findOne({
					userId: userId,
					depositType: currency.toUpperCase(),
					executedAt: null
					//TODO expiration date may be required (!!!important!!!)
				}, (err, wallet) => {
					cb(null, wallet);
				});
			},
			(wallet, cb) => {
				if(wallet) {
					cb(null, wallet);
				} else {
					CrowdsaleController.createTransactionWallet(currency, userId, data.user.address, cb);
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
			
			callback(null, transactions);
		});
		
	}
	
	rates(callback, data) {
		callback(null, Controllers.crowdsale.ratesData);
	}
	
	static createTransactionWallet(currency, userId, userAddress, callback) {
		async.waterfall([
			(cb) => {
				request({
					method: 'POST',
					uri: 'https://shapeshift.io/shift',
					json: {
						withdrawal: userAddress || config['ethereum']['public_key'],
						pair: `${currency.toLowerCase()}_eth`,
						// returnAddress:"BBBBBBBBBBB",//TODO return address may be required (!!!important!!!)
						apiKey: config['shapeshift']['public_key']
					}
				}, (error, response, body) => {
					if(error || response.statusCode != 200) {
						cb('Create transaction wallet error: ' + error);
					} else if(body.error) {
						cb('Api error' + body.error);
					} else {
						cb(null, body);
					}
				});
			},
			(response, cb) => {
				let coin = response.depositType.toUpperCase(),
					newWallet = {
						userId: userId,
						orderId: response.orderId,
						deposit: response.deposit,
						depositType: coin,
						extraInfo: (coin == 'XMR' || coin == 'BTS') ? response.sAddress : null,
						executed: false,
						executedAt: null
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
}

Controllers.crowdsale = new CrowdsaleController();