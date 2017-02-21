/**
 * Created by shumer on 2/21/17.
 */
let request = require('request'),
    async = require('async'),
    logger = require('log4js').getLogger('Crowdsale Controller'),
    config = require(ConfigPath);

let Controllers = getControllers(),
    Models = getModels();

class CrowdsaleController {

    constructor() {
        logger.info('Crowdsale controller initialized');
    }

    deposit(callback, data){
        let { currency } = data._post,
            user = data.req.user,
            userId;

        if(!currency) {
            return callback('Currency is required');
        }

        async.waterfall([
            (cb)=>{
                Models.users.findOne({
                    email: user.email.toLowerCase()
                }, (err, user)=>{
                    userId = user._id;
                    cb();
                });
            },
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

            callback(null, {
                wallet  : wallet.deposit,
                type    : wallet.depositType.toUpperCase()
            });
        });
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
                let newWallet = {
                    userId : userId,
                    orderId : response.orderId,
                    deposit: response.deposit,
                    depositType: response.depositType.toUpperCase(),
                    extraInfo: response.public || response.xrpDestTag,
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