/**
 * Created by shumer on 2/21/17.
 */
let request = require('request'),
	async = require('async'),
	logger = require('log4js').getLogger('Crowdsale Controller'),
	config = require('config'),
	cron = require('node-cron'),
	fx = require("money"),
	BigNumber = require('bignumber.js'),
	ethHelper = require('../Components/eth'),
    changelly = require('../Helpers/changelly');

let Controllers = getControllers(),
	Contracts = getContracts(),
	Models = getModels();

class CronController {
	
	constructor() {
		logger.info('Cron controller initialized');
	}
	
	init() {
		this.handleDeposits();
		if(!config.currencies.enable) return;
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
                if(result.status != 'complete') {
                    return cb(null, null, null);
                }
                Models.transactions.findOne({
                    txHash: result.transaction
                }, (err, TX) => {
                    if(err) return cb(err);
                    if(!TX) return cb();
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
        changelly.getTransactions(20, 0, undefined, deposit, undefined, (error, data) => {
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
                    if(transaction.status != 'finished') {
                        return cb();
                    }
                    Models.transactions.findOne({
                        txHash: transaction.payoutHash
                    }, (err, TX) => {
                        if(err) return cb(err);
                        if(!TX) return cb();
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

	static getShapeShiftRate(coin, next, callback){
        request({
            method: 'GET',
            uri: `https://shapeshift.io/rate/eth_${coin.toLowerCase()}`
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
                    logger.warn('Get crypto rate return null', `eth_${coin.toLowerCase()}`, info);
                    return next();
                }
                callback(coin, info.rate);
                next();
            }
        });
    }

    static getChangellyRate(coin, next, callback){
        changelly.getExchangeAmount('ETH', coin, 1, (error, result)=>{
            if(error){
                logger.warn('Get rate from changelly error: ' + error);
                next();
            } else if(!result || !result.result){
                logger.warn('Get rate from changelly error: no data');
            } else {
                callback(coin, result.result);
                next();
            }
        });
    }

	static handleRates() {
		let timestamp = Math.round(Date.now()/1000 - 2*60*60);

		let tokenPrice = Controllers.crowdsale.getTokenPrice();
		
		async.parallel({
			crypto: (callback) => {
				let cryptoRates = [];
				async.eachSeries(config['currencies']['crypto'], (name, next) => {
					if(name == 'ETH') {
						cryptoRates.push([name, new BigNumber(1)]);
						return next();
					}

					CronController.getChangellyRate(name, next, (name, rate)=>{
                        cryptoRates.push([name, new BigNumber(rate)]);
                    });

				}, (err) => {
					let result = {};
					cryptoRates.forEach(row => {
						result[row[0]] = row[1].mul(tokenPrice).toFixed(6);
					});
					callback(null, result);
				});
			},
			fiat: (callback) => {
                if(config.hasOwnProperty('bravenewcoin-key') && config['bravenewcoin-key']){
                    let fiatRates = [];
                    async.eachSeries(config['currencies']['fiat'], (name, next) => {
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

                            if(response.statusCode !== 200){
                                logger.warn('Get bravenewcoin error: ' + parsedData.message);
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
                            return {[info.name]: (info.rate * tokenPrice).toFixed(6)};
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

                                    cb(null, config['currencies']['fiat'].map((key) => {
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
                            return {[info.key]: (info.rate * results.usd_eth * tokenPrice).toFixed(6)};
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


