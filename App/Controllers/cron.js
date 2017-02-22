/**
 * Created by shumer on 2/21/17.
 */
let request = require('request'),
    async = require('async'),
    logger = require('log4js').getLogger('Crowdsale Controller'),
    config = require(ConfigPath),
    cron = require('node-cron');

let Controllers = getControllers(),
    Models = getModels();

class CronController {

    constructor() {
        logger.info('Cron controller initialized');

        cron.schedule('* * * * *', ()=>{
            CronController.handleDeposits();
        });

    }

    static handleDeposits(){
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
                                endDate = Date.parse(config['deadline']),
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

                            let fundAmount = incomeETH * tokenPrice;

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
}


Controllers.cron = new CronController();