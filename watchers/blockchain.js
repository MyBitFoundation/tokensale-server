/**
 * Created by shumer on 3/10/17.
 */
global.RootDir = `${__dirname}/../`;
global.ConfigPath = `${RootDir}config/main.json`;

const async     = require('async');
const Web3      = require('web3');
const abe       = require('../App/Contracts/crowdsale.abe.json');
const logger    = require('log4js').getLogger('Watcher blockchain');
const config    = require(global.ConfigPath);
const fs        = require('fs');
const ethHelper = require(`${RootDir}App/Components/eth`);
const Raven = require('raven');

logger.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
logger.error("!!!! Don't forget remove file with password !!!!");
logger.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");

global.ethPassword = fs.readFileSync(`${RootDir}password`).toString();

if(!config['disableRaven']) {
    Raven.config('https://c49da81fc9914402ab681dbf9b4684bc:f401db00f9064d0eb37e8a076294104e@sentry.pixelplex.by/2', {
        autoBreadcrumbs: true
    }).install((e, d) => {
        logger.error(d);
        process.exit(1);
    });
}
global.raven = Raven;
global.sendWarning = (message, data) => {
    logger.warn(message, data);

    if(!Raven || config['disableRaven']) {
        return;
    }

    Raven.captureMessage(message, {
        level: 'warning',
        extra: { error: data }
    });
};

let web3 = new Web3(new Web3.providers.HttpProvider(config['ethereum']['rpc']));
web3._extend({
    property: 'personal',
    methods: [new web3._extend.Method({
        name: 'importRawKey',
        call: 'personal_importRawKey',
        params: 2
    })],
    properties: []
});

global.ethRPC = web3;

class Processor {

    constructor(){
        this.models = [];
        this.lastProcessedBlockIndex = null;

        async.waterfall([
            (cb)=>{
                require(`${RootDir}App/Controllers/modelsWrapper`)((err, mongoModels)=>{
                    if(err) {
                        logger.error("Error in init models:", err);
                        return cb(err);
                    }

                    this.models = mongoModels;
                    cb();
                });
            },
            (cb)=>{
                this.models.settings.get('last_processed_eth_block', (err, result) => {
                    this.lastProcessedBlockIndex = parseInt(result || config['ethereum']['firstBlockForProcessing'] || 0);
                    cb();
                });
            },
            (cb)=>{
                this.processGlobal(cb);
            }
        ], (error, result)=>{
            console.log("done");
        });
    }

    getTokenPrice(){
        let contract = ethRPC.eth.contract(abe).at(config['ethereum']['crowdSaleContractAddress']);
        let amountRaised = contract.amountRaised() / 1000000000000000000;

        if(!amountRaised || amountRaised < 2000) {
            return 250;
        } else if(amountRaised < 8000) {
            return 150;
        } else {
            return 100;
        }
    }

    processGlobal(){
        let lastBlock = ethRPC.eth.getBlock("latest");

        if(!lastBlock || !lastBlock.number) {
            return;
        }

        this.lastBlockIndex = lastBlock.number;
        this.currentBlockIndex = this.lastProcessedBlockIndex;

        async.whilst(
            () => {
                return parseInt(this.currentBlockIndex) < parseInt(this.lastBlockIndex);
            },
            (callback)=>{
                return this.processBlock(callback)
            },
            (error) => {
                if(error) {
                    logger.error('[processGlobal][result] : ', error);
                }

                setTimeout(() => this.processGlobal(), 20 * 1000);
            }
        );
    }

    processBlock(callback){
        let currentBlock = ethRPC.eth.getBlock(this.currentBlockIndex + 1);

        if(!currentBlock || !currentBlock.number || !currentBlock.transactions || !Array.isArray(currentBlock.transactions)) {
            return callback();
        }

        this.currentBlockIndex = currentBlock.number;

        logger.info(`Start processed block ${this.currentBlockIndex} with ${currentBlock.transactions.length} transactions`);

        logger.info(currentBlock);
        async.eachSeries(currentBlock.transactions, (txHash, next) => {
            this.processTransaction(txHash, next)
        }, (error) => {
            if(error) {
                this.lastProcessedBlockIndex = this.currentBlockIndex - 1;
                this.models.settings.set('last_processed_eth_block', this.lastProcessedBlockIndex);

                logger.error('[processBlock][result] : ', error);
                return callback(error);
            }

            this.models.settings.set('last_processed_eth_block', this.currentBlockIndex, (error) => {
                if(error){
                    logger.error('[processBlock][set settings] : ', error);
                    return callback(error);
                }

                callback();
            });
        });
    }

    processTransaction(txHash, callback){
    	console.time('getTransaction');
        let currentTransaction = ethRPC.eth.getTransaction(txHash);
        console.timeEnd('getTransaction');

        if(!currentTransaction || !currentTransaction.to || !currentTransaction.value)
            return callback();

        let address = currentTransaction.to.toString();

        async.waterfall([
            (cb)=>{
                this.models.users.findOne({address}, (error, user)=>{
                    if(error){
                        logger.error('[processTransaction][fetch user] : ', error);
                        return cb(error, null);
                    }
                    return cb(null, user);
                });
            },
            (user, cb)=>{
                if(!user){
                    return cb(null, null, null);
                }
                this.models.transactions.findOne({txHash}, (error, transaction) => {
                    if(error){
                        logger.error('[processTransaction][fetch transaction] : ', error);
                        return cb(error, null, null);
                    }

                    return cb(null, user, transaction);
                });
            },
            (user, transaction, cb)=>{
                if(!user || transaction){
                    return cb();
                }

                let gas = 30000,
                    tokenPrice = this.getTokenPrice(),
                    userId = user._id,
                    maxCommission = ethRPC.fromWei(gas * ethRPC.eth.gasPrice, 'ether'),
                    maxCommissionInWei = parseInt(ethRPC.toWei(maxCommission, 'ether')),
                    amount = ethRPC.fromWei(currentTransaction.value, 'ether').toNumber(),
                    amountInWei = parseInt(ethRPC.toWei(amount, 'ether')),
                    resultAmount = tokenPrice * (amount - maxCommission);

                let balance = ethRPC.eth.getBalance(user.address);

                if(parseInt(balance) < parseInt(amountInWei)){
                    amountInWei = parseInt(balance);
                }

                if(amountInWei < maxCommissionInWei) {
                    sendWarning('Invalid balance', {
                        amount      : ethRPC.toWei(amount, 'ether'),
                        balance     : balance,
                        comission   : maxCommissionInWei
                    });
                    return cb();
                }

                try {
                    ethRPC.personal.unlockAccount(user.address, ethPassword);
                } catch(error) {
                    if(error){
                        logger.error('[processTransaction][unlock account] : ', error);
                        return cb(error);
                    }
                }

                logger.info('[processTransaction][send transaction] : ', {
                    from    : user.address,
                    to      : config['ethereum']['crowdSaleContractAddress'],
                    value   : amountInWei - maxCommissionInWei,
                    balance : balance,
                    gas     : gas
                });

                ethRPC.eth.sendTransaction({
                    from    : user.address,
                    to      : config['ethereum']['crowdSaleContractAddress'],
                    value   : amountInWei - ethRPC.toWei(maxCommission, 'ether'),
                    gas     : gas
                }, (error, crowdSaleTxHash) => {
                    logger.info('[processTransaction][transaction hash] : ', crowdSaleTxHash);

                    if(error){
                        logger.error('[processTransaction][send transaction] : ', error);
                        return cb(error);
                    }

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

                    this.models.transactions.create(transaction, (err, TX) => {
                        if(error){
                            logger.error('[processTransaction][create transaction] : ', error);
                            return cb(error);
                        }

                        return cb();
                    });
                });
            }
        ], (error, result)=>{
            if(error){
                logger.error('[processTransaction][result] : ', error);
                return callback(error)
            }

            callback();
        });
    }
}

new Processor();