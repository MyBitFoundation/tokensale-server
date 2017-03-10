/**
 * Created by shumer on 2/21/17.
 */
let request = require('request'),
	async = require('async'),
	logger = require('log4js').getLogger('Crowdsale Controller'),
	config = require(ConfigPath),
	cron = require('node-cron'),
	fx = require("money"),
	BigNumber = require('bignumber.js'),
	ethHelper = require('../Components/eth'),
    changelly = require('../Components/changelly');

let Controllers = getControllers(),
	Contracts = getContracts(),
	Models = getModels();

class CronController {
	
	constructor() {
		logger.info('Cron controller initialized');
		this.lastProcessedBlockIndex = 0;
		this.processedTransactions = {};
	}
	
	init() {
		this.handleDeposits();

		//TODO only for tests.
		if(config['ethereum']['rpc_enabled']) {
			Models.settings.get('last_processed_eth_block', (err, result) => {
				this.lastProcessedBlockIndex = parseInt(result || config['ethereum']['firstBlockForProcessing']);
				this.handleETHDeposits();
			});
		}

		CronController.handleRates();
		cron.schedule('0 0 * * *', () => {
			CronController.handleRates();
		});
	}

	handleDeposits(){
        async.waterfall([
            (cb) => {
                Models.depositWallets.find({
                    executedAt: null
                }, (err, wallets) => {
                    cb(null, wallets);
                });
            },
            (wallets, cb) => {
                async.eachSeries(wallets, (wallet, callback) => {
                    this.handleDepositsFromChangelly(wallet, callback);
                }, cb)
            }
        ], (err) => {
            if(err) return GlobalError('33033044', err);
            setTimeout(() => this.handleDeposits(), 60 * 1000);
        });
	}

    getShapeShiftTx(deposit, cb) {
        request({
            method: 'GET',
            uri: `https://shapeshift.io/txStat/${deposit}`
        }, (error, response, body) => {
            if(error || response.statusCode != 200) {
                sendWarning('Get getShapeShiftTx error', error);
                return setTimeout(() => this.getShapeShiftTx(deposit, cb), 2000);
            }

            if(body.error)
                return cb(body.error);

            cb(null, JSON.parse(body));
        });
    }

	handleDepositsFromShapeShift(wallet, callback) {
        async.waterfall([
            (cb) => {
                this.getShapeShiftTx(wallet.deposit, cb);
            },
            (result, cb) => {
                if(result.status != 'complete' || this.processedTransactions[result.transaction]) {
                    return cb(null, null, null);
                }
                Models.transactions.findOne({
                    txHash: result.transaction
                }, (err, TX) => {
                    if(err) return cb(err);
                    if(!TX) return cb();
                    this.processedTransactions[result.transaction] = true;
                    // already processed
                    if(TX.currency != 'ETH') {
                        return cb();
                    }
                    TX.currency = result.incomingType;
                    TX.amount = result.incomingCoin;
                    TX.address = result.address;
                    TX.save((err) => {
                        if(err) return cb(err);
                        return cb();
                    });
                });
            }
        ], callback);
	}

	getChangellyTx(deposit, cb){
        changelly.getTransactions(20, 0, undefined, deposit, undefined, function(error, data) {
            if(error){
                sendWarning('Get getChangellyTx error', error);
                return setTimeout(() => this.getChangellyTx(deposit, cb), 2000);
			}

            if(data.error)
                return cb('Create transaction wallet error: ' + data.error.message);

            cb(null, data.result);
        });
	}

	handleDepositsFromChangelly(wallet, callback){
        async.waterfall([
            (cb) => {
                this.getChangellyTx(wallet.deposit, cb);
            },
			(transactions, callback)=>{
                async.eachSeries(transactions, (transaction, cb) => {
                    if(transaction.status != 'finished' || this.processedTransactions[transaction.payoutHash]) {
                        return cb();
                    }
                    Models.transactions.findOne({
                        txHash: transaction.payoutHash
                    }, (err, TX) => {
                        if(err) return cb(err);
                        if(!TX) return cb();
                        this.processedTransactions[transaction.payoutHash] = true;
                        // already processed
                        if(TX.currency != 'ETH') {
                            return cb();
                        }
                        TX.currency = transaction.currencyFrom.toUpperCase();
                        TX.amount = transaction.amountFrom;
                        TX.address = transaction.payinAddress;
                        TX.save((err) => {
                            if(err) return cb(err);
                            return cb();
                        });
                    });
                }, callback)
			}
        ], callback);
	}

	handleETHDeposits() {
		let lastBlock = ethRPC.eth.getBlock("latest");
		
		if(!lastBlock || !lastBlock['number']) {
			return;
		}
		
		let lastBlockIndex = lastBlock['number'],
			currentBlockIndex = this.lastProcessedBlockIndex; //TODO set last from settings;
		
		let tokenPrice = Controllers.crowdsale.getTokenPrice();
		
		async.whilst(
			() => {
				return parseInt(currentBlockIndex) < parseInt(lastBlockIndex);
			},
			(blockCallback) => {
				let currentBlock = ethRPC.eth.getBlock(currentBlockIndex + 1);
				currentBlockIndex = currentBlock.number;
				
				logger.info(`Start processed block ${currentBlockIndex} with ${currentBlock.transactions.length} transactions`);
				async.eachSeries(currentBlock.transactions, (txHash, next) => {
					let currentTransaction = ethRPC.eth.getTransaction(txHash);
					if(!currentTransaction)
						return next();
					
					if(!Controllers.users.users.hasOwnProperty(currentTransaction.to)) {
						return next();
					}
					
					let gas = 30000;
					
					let userId = Controllers.users.users[currentTransaction.to],
						maxCommission = ethRPC.fromWei(gas * ethRPC.eth.gasPrice, 'ether'),
						amount = ethRPC.fromWei(currentTransaction.value, 'ether').toNumber(),
						resultAmount = tokenPrice * (amount - maxCommission);
					
					Models.transactions.findOne({txHash}, (err, transaction) => {
						if(transaction) {
							return next();
						}
						let amountInWei = ethRPC.toWei(amount, 'ether');
						Models.users.findOne({_id: userId}, (err, user) => {
							let balance = ethRPC.eth.getBalance(user.address);
							
							if(parseInt(balance) < parseInt(amountInWei))
								amountInWei = balance;
							
							if(err) return next(err);
							
							try {
								ethRPC.personal.unlockAccount(user.address, ethPassword);
							} catch(e) {
								return next(err);
							}
							
							if(amountInWei < ethRPC.toWei(maxCommission, 'ether')) {
								sendWarning('Invalid balance', {
									amount: ethRPC.toWei(amount, 'ether'),
									balance: balance,
									comission: ethRPC.toWei(maxCommission, 'ether')
								});
								return next();
							}
							logger.info({
								from: user.address,
								to: config['ethereum']['crowdSaleContractAddress'],
								value: amountInWei - ethRPC.toWei(maxCommission, 'ether'),
								balance: balance,
								gas: gas
							});
							ethRPC.eth.sendTransaction({
								from: user.address,
								to: config['ethereum']['crowdSaleContractAddress'],
								value: amountInWei - ethRPC.toWei(maxCommission, 'ether'),
								gas: gas
							}, (err, crowdSaleTxHash) => {
								logger.info('tx', crowdSaleTxHash);
								if(err) return next(err);
								logger.info(`New transaction from ${user.address} to contract`);
								
								let transaction = {
									userId: userId,
									amount: ethRPC.fromWei(amountInWei - ethRPC.toWei(maxCommission, 'ether'), 'ether'),
									ethAmount: ethRPC.fromWei(amountInWei - ethRPC.toWei(maxCommission, 'ether'), 'ether'),
									currency: 'ETH',
									receivedTokens: resultAmount,
									txHash: txHash,
									crowdSaleTxHash: crowdSaleTxHash,
									tokenPrice: tokenPrice,
									address: user.address
								};
								Models.transactions.create(transaction, (err, TX) => {
									if(err) return GlobalError('10:57', err, next);
									return next();
								});
							});
						});
					});
				}, (err) => {
					if(err) {
						logger.error('handleETHDeposits', err);
						this.lastProcessedBlockIndex = currentBlockIndex - 1;
						Models.settings.set('last_processed_eth_block', this.lastProcessedBlockIndex);
						return setTimeout(() => this.handleETHDeposits(), 20 * 1000);
					}
					Models.settings.set('last_processed_eth_block', currentBlockIndex, (err) => {
						blockCallback(null, currentBlockIndex);
					});
				});
			},
			(err) => {
				if(err) {
					logger.error(1, err);
				} else {
					this.lastProcessedBlockIndex = currentBlockIndex;
					Models.settings.set('last_processed_eth_block', currentBlockIndex);
				}
				setTimeout(() => this.handleETHDeposits(), 20 * 1000);
			}
		);
	}
	
	static handleRates() {
		let rates = {
			crypto: {
				BTC: null,
				ETH: null,
				ETC: null,
				XMR: null,
				DASH: null,
				REP: null
			},
			fiat: {
				EUR: null,
				USD: null,
				CNY: null,
				GBP: null,
				AUD: null,
				CAD: null,
				SGD: null,
				INR: null,
				RUB: null,
				JPY: null
			}
		};

		let timestamp = Math.round(Date.now()/1000 - 2*60*60);

		let tokenPrice = Controllers.crowdsale.getTokenPrice();
		
		async.parallel({
			crypto: (callback) => {
				let cryptoRates = [];
				async.eachSeries(Object.keys(rates.crypto), (name, next) => {
					if(name == 'ETH') {
						cryptoRates.push([name, new BigNumber(1)]);
						return next();
					}
					request({
						method: 'GET',
						uri: `https://shapeshift.io/rate/eth_${name.toLowerCase()}`
					}, (error, response, body) => {
						if(error || response.statusCode != 200) {
							logger.warn('Get rate from shapeshift error: ' + error);
							next();
						} else if(body.error) {
							logger.warn('Get rate from shapeshift error: ' + body.error);
							next();
						} else {
							let info = JSON.parse(body);
							
							if(!info.rate || !parseFloat(info.rate)) {
								logger.warn('Get crypto rate return null', `eth_${name.toLowerCase()}`, info);
								return next();
							}
							cryptoRates.push([name, new BigNumber(parseFloat(info.rate))]);
							next();
						}
					});
				}, (err) => {
					let result = {};
					cryptoRates.forEach(row => {
						result[row[0]] = row[1].div(tokenPrice).toFixed(6);
					});
					callback(null, result);
				});
			},
			fiat: (callback) => {
                if(config.hasOwnProperty('bravenewcoin-key') && config['bravenewcoin-key']){
                    let fiatRates = [];
                    async.eachSeries(Object.keys(rates.fiat), (name, next) => {
                        request({
                            headers: {
                                'X-Mashape-Key'	: config['bravenewcoin-key'],
                                'Accept'		: 'application/json'
                            },
                            method: 'GET',
                            uri: `https://bravenewcoin-mwa-historic-v1.p.mashape.com/mwa-historic?coin=eth&from=${timestamp}&market=${name.toLowerCase()}`
                        }, (error, response, body) => {
                            if(error){
                                logger.warn('Get bravenewcoin error: ' + error);
                                return next();
                            }

                            let parsedData = JSON.parse(body);

                            if(response.statusCode != 200){
                                logger.warn('Get bravenewcoin error: ' + data.message);
                                return next();
                            }

                            let {column_names, data} = parsedData;

                            if(!data.length){
                                logger.warn('Get bravenewcoin error: no data');
                                return next();
                            }

                            let [rate] = data;
                            let key = column_names.indexOf('index');

                            if(!rate || !rate[key]) {
                                logger.warn('Get bravenewcoin error: index is empty');
                                return next();
                            }

                            fiatRates.push({name, rate : new BigNumber(parseFloat(rate[key]))});
                            next()
                        });



                    }, (err) => {
                        callback(null, Object.assign({}, ...fiatRates.map((info) => {
                            return {[info.name]: (info.rate / tokenPrice).toFixed(6)};
                        })));
                    });
                } else {
                    logger.error('bravenewcoin X-Mashape-Key is not set');

                    async.parallel({
                        fiat_usd: (innerCallback) => {
                            async.waterfall([
                                (cb) => {
                                    request({
                                        method: 'GET',
                                        uri: `http://api.fixer.io/latest?base=USD`
                                    }, (error, response, body) => {
                                        if(error || response.statusCode != 200) {
                                            cb('fixer.io api error');
                                        } else {
                                            cb(null, JSON.parse(body));
                                        }
                                    });
                                },
                                (info, cb) => {
                                    fx.rates = info.rates;
                                    fx.rates['USD'] = 1;

                                    cb(null, Object.keys(rates.fiat).map((key) => {
                                        return {key, rate: new BigNumber(fx(1).from('USD').to(key))}
                                    }));
                                }
                            ], innerCallback);
                        },
                        usd_eth: (innerCallback) => {
                            async.waterfall([
                                (cb) => {
                                    request({
                                        method: 'GET',
                                        uri: `https://api.coinmarketcap.com/v1/ticker/ethereum/`
                                    }, (error, response, body) => {
                                        if(error || response.statusCode != 200) {
                                            cb('coinmarketcap.com api error');
                                        } else {
                                            cb(null, JSON.parse(body));
                                        }
                                    });
                                },
                                (info, cb) => {
                                    if(!info[0] || !info[0]['price_usd']) {
                                        return cb('coinmarketcap.com api error');
                                    }

                                    cb(null, new BigNumber(info[0]['price_usd']));
                                }
                            ], innerCallback);
                        }
                    }, (err, results) => {
                        if(err) return callback(err);

                        callback(null, Object.assign({}, ...results.fiat_usd.map((info) => {
                            return {[info.key]: (info.rate * results.usd_eth / tokenPrice).toFixed(6)};
                        })));
                    });
                }
			}
		}, (err, rates) => {
			logger.info(`Rates updated`);
			console.log(rates);
			if(rates.crypto)
				Controllers.crowdsale.ratesData.crypto = rates.crypto;
			if(rates.fiat)
				Controllers.crowdsale.ratesData.fiat = rates.fiat;
		});
	}
}

Controllers.cron = new CronController();


