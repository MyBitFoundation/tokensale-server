/**
 * Created by shumer on 2/21/17.
 */
let request = require('request'),
    async = require('async'),
    logger = require('log4js').getLogger('Crowdsale Controller'),
    config = require(ConfigPath),
    moment = require('moment'),
    fx = require("money"),
    BigNumber = require('bignumber.js');

fx.base = "USD";

let Controllers = getControllers(),
    Models = getModels();

class CrowdsaleController {

    constructor() {
        logger.info('Crowdsale controller initialized');
    }

    deposit(callback, data){
        let { currency } = data._post,
            userId = data.req.user._id;

        if(!currency) {
            return callback('Currency is required');
        }

        async.waterfall([
            (cb)=>{
                Models.depositWallets.findOne({
                    userId: userId,
                    depositType : currency.toUpperCase(),
                    executedAt : null
                    //TODO expiration date may be required (!!!important!!!)
                }, (err, wallet)=>{
                    cb(null, wallet);
                });
            },
            (wallet, cb) => {
                if(wallet){
                    cb(null, wallet);
                } else {
                    CrowdsaleController.createTransactionWallet(currency, userId, cb);
                }
            }
        ], (err, wallet)=>{
            if(err) return GlobalError('20012012', err, callback);

            let response = {
                address     : wallet.deposit,
                type        : wallet.depositType.toUpperCase()
            };

            if(response.type == 'BTS'){
                response.memo = wallet.extraInfo;
            } else if(response.type == 'XMR'){
                response.paymentId = wallet.extraInfo;
            }

            callback(null, response);
        });
    }

    transactions(callback, data){
        let userId = data.req.user._id,
            sort = -1;

        if(data._get.sort && data._get.sort == 1 || data._get.sort == -1){
            sort = data._get.sort;
        }

        Models.depositWallets.find({
            userId: userId,
            executedAt : {$ne:null}
        }, null, { sort : { executedAt : sort}}, (err, wallets)=>{
            let transactions = wallets.map((wallet)=>{
                return {
                    date          : moment(wallet.executedAt).format('YYYY-MM-DD HH:mm:ss'),
                    sentAmount    : parseFloat(wallet.transaction.incomingCoin),
                    sentCoinType  : wallet.transaction.incomingType,
                    transactionId : wallet.transaction.transaction,
                    address       : wallet.transaction.withdraw,
                    amount        : parseFloat(wallet.transaction.fundAmount),
                    rate          : parseFloat(wallet.transaction.incomingCoin / wallet.transaction.fundAmount)
                };
            });

            callback(null, transactions);
        });

    }

    rates(globalCallback, data){
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
            dayTimestamp = 60 / 60 / 24 / 1000,
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
                                        cb('Api error');
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
                                        cb('coinmarketcap api error');
                                    } else {
                                        cb(null, JSON.parse(body));
                                    }
                                });
                            },
                            (info, cb)=>{
                                if(!info[0] || !info[0]['price_usd']){
                                    return cb('coinmarketcap api error');
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
        }, globalCallback);
    }

    static createTransactionWallet(currency, userId, callback){
        async.waterfall([
            (cb)=>{
                request({
                    method: 'POST',
                    uri: 'https://shapeshift.io/shift',
                    json: {
                        withdrawal:config['ethereum']['public_key'],
                        pair:`${currency.toLowerCase()}_eth`,
                        // returnAddress:"BBBBBBBBBBB",//TODO return address may be required (!!!important!!!)
                        apiKey : config['shapeshift']['public_key']
                    }
                },(error, response, body)=>{
                    if(error || response.statusCode != 200){
                        cb('Api error');
                    } else if(body.error) {
                        cb(body.error);
                    } else {
                        cb(null, body);
                    }
                });
            },
            (response, cb)=>{
                let coin = response.depositType.toUpperCase(),
                    newWallet = {
                        userId : userId,
                        orderId : response.orderId,
                        deposit: (coin == 'XMR' || coin == 'BTS') ? response.sAddress : response.deposit,
                        depositType: coin,
                        extraInfo: (coin == 'XMR' || coin == 'BTS') ? response.deposit : null,
                        executed : false,
                        executedAt : null
                    };

                Models.depositWallets.create(newWallet, err=>{
                    if(err) return cb('Insert deposit wallet error');
                    logger.info(`New ${currency} wallet created by user ${userId}`);
                    cb(null, newWallet);
                });
            }
        ], callback);

    }
}

Controllers.crowdsale = new CrowdsaleController();