/**
 * Created by shumer on 2/21/17.
 */
let request = require('request'),
    async = require('async'),
    logger = require('log4js').getLogger('Crowdsale Controller'),
    config = require(ConfigPath),
    cron = require('node-cron'),
    fx = require("money"),
    BigNumber = require('bignumber.js');

let Controllers = getControllers(),
    Models = getModels();

class CronController {

    constructor() {
        logger.info('Cron controller initialized');

        CronController.handleDeposits();
        cron.schedule('* * * * *', ()=>{
            CronController.handleDeposits();
        });

        CronController.handleRates();
        cron.schedule('* * * * *', ()=>{
            CronController.handleRates();
        });
    }

    static handleDeposits(){
        let endDate = Date.parse(config['deadline']),
            currentDate = Date.now(),
            dayTimestamp = 24 * 60 * 60 * 1000,
            tokenPrice;

        if (endDate - currentDate > 3 * 7 * dayTimestamp){
            tokenPrice = 100;
        } else if (endDate - currentDate > 7 * dayTimestamp){
            tokenPrice = 150;
        } else {
            tokenPrice = 250;
        }

        async.waterfall([
            (cb)=>{
                Models.depositWallets.find({
                    executedAt : null
                }, (err, wallets)=>{
                    cb(null, wallets);
                });
            },
            (wallets, firstCb)=>{
                async.each(wallets, (wallet, secondCb)=>{
                    async.waterfall([
                        (cb)=>{
                            request({
                                method: 'GET',
                                uri: `https://shapeshift.io/txStat/${wallet.deposit}`
                            },(error, response, body)=>{
                                if(error || response.statusCode != 200){
                                    cb('Api error');
                                } else if(body.error) {
                                    cb(body.error);
                                } else {
                                    cb(null, JSON.parse(body));
                                }
                            });
                        },
                        (result, cb)=>{
                            if(result.status != 'complete'){
                                return cb(null, null);
                            }

                            let incomeETH = parseFloat(result.outgoingCoin),
                                fundAmount = incomeETH * tokenPrice;

                            logger.info(`New executed transaction found. Deposit wallet id: ${wallet._id}`);
                            wallet.executedAt = Date.now();
                            wallet.transaction = {
                                withdraw        : result.withdraw,
                                incomingCoin    : result.incomingCoin,
                                incomingType    : result.incomingType,
                                address         : result.address,
                                outgoingCoin    : result.outgoingCoin,
                                outgoingType    : result.outgoingType,
                                transaction     : result.transaction,
                                fundAmount      : fundAmount
                            };
                            wallet.save((err, wallet)=>{
                                cb(err, wallet);
                            });
                        },
                        (wallet, cb)=>{
                            if(!wallet){
                                return cb(null, null, null);
                            }
                            Models.users.findOne({
                                _id: wallet.userId
                            }, (err, user)=>{
                                cb(null, user, wallet);
                            });
                        },
                        (user, wallet, cb)=>{
                            if(!user || !wallet){
                                return cb();
                            }

                            logger.info(`Fund user ${user._id} balance with ${wallet.transaction.fundAmount} finney`);
                            user.balance = (user.balance + wallet.transaction.fundAmount);
                            user.save((err, user)=>{
                                cb(err, user);
                            });
                        }
                    ], secondCb);
                }, firstCb)
            }
        ], (err)=>{
            if(err) return GlobalError('33033044', err);
        });

    }

    static handleRates(){
        let rates = {
            crypto : {
                BTC : null,
                ETH : null,
                ETC : null,
                XMR : null,
                DASH: null,
                REP : null
            },
            fiat : {
                EUR : null,
                USD : null,
                CNY : null,
                GBP : null,
                AUD : null,
                CAD : null,
                SGD : null,
                INR : null,
                RUB : null,
                JPY : null
            }
        };

        let endDate = Date.parse(config['deadline']),
            currentDate = Date.now(),
            dayTimestamp = 24 * 60 * 60 * 1000,
            tokenPrice;

        if (endDate - currentDate > 3 * 7 * dayTimestamp){
            tokenPrice = 100;
        } else if (endDate - currentDate > 7 * dayTimestamp){
            tokenPrice = 150;
        } else {
            tokenPrice = 250;
        }

        async.parallel({
            crypto  : (callback)=>{
                async.parallel(Object.keys(rates.crypto).map((key)=>{
                    return (cb)=>{
                        if(key == 'ETH'){
                            return cb(null, { key, rate: new BigNumber(1) });
                        }

                        request({
                            method: 'GET',
                            uri: `https://shapeshift.io/rate/eth_${key.toLowerCase()}`
                        },(error, response, body)=>{
                            if(error || response.statusCode != 200){
                                cb('Api error');
                            } else if(body.error) {
                                cb(body.error);
                            } else {
                                let info = JSON.parse(body);
                                cb(null, { key, rate : new BigNumber(info.rate) });
                            }
                        });
                    }
                }), (err, results)=>{
                    callback(null, Object.assign({}, ...results.map((info)=>{
                        return { [info.key] : info.rate.div(tokenPrice).toFixed(6) };
                    })));
                });
            },
            fiat    : (callback)=>{
                async.parallel({
                    fiat_usd : (innerCallback)=>{
                        async.waterfall([
                            (cb)=>{
                                request({
                                    method: 'GET',
                                    uri: `http://api.fixer.io/latest?base=USD`
                                },(error, response, body)=>{
                                    if(error || response.statusCode != 200){
                                        cb('fixer.io api error');
                                    } else {
                                        cb(null, JSON.parse(body));
                                    }
                                });
                            },
                            (info, cb)=>{
                                fx.rates = info.rates;
                                fx.rates['USD'] = 1;

                                cb(null, Object.keys(rates.fiat).map((key)=>{
                                    return { key, rate : new BigNumber(fx(1).from('USD').to(key)) }
                                }));
                            }
                        ], innerCallback);
                    },
                    usd_eth : (innerCallback)=>{
                        async.waterfall([
                            (cb)=>{
                                request({
                                    method: 'GET',
                                    uri: `https://api.coinmarketcap.com/v1/ticker/ethereum/`
                                },(error, response, body)=>{
                                    if(error || response.statusCode != 200){
                                        cb('coinmarketcap.com api error');
                                    } else {
                                        cb(null, JSON.parse(body));
                                    }
                                });
                            },
                            (info, cb)=>{
                                if(!info[0] || !info[0]['price_usd']){
                                    return cb('coinmarketcap.com api error');
                                }

                                cb(null, new BigNumber(info[0]['price_usd']));
                            }
                        ], innerCallback);
                    }
                }, (err, results)=>{
                    if(err) return callback(err);

                    callback(null, Object.assign({}, ...results.fiat_usd.map((info)=>{
                        return { [info.key] : (info.rate * results.usd_eth / tokenPrice).toFixed(6) };
                    })));
                });
            }
        }, (err, rates)=>{
            logger.info(`Rates updated`);
            Controllers.crowdsale.ratesData = rates;
        });
    }
}


Controllers.cron = new CronController();