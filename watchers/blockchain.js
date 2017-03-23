/**
 * Created by shumer on 3/10/17.
 */
global.RootDir = `${__dirname}/../`;
global.ConfigPath = `${RootDir}config/main.json`;

const async = require('async');
const Web3 = require('web3');
const abe = require('../App/Contracts/crowdsale.abe.json');
const logger = require('log4js').getLogger('Watcher blockchain');
const config = require(global.ConfigPath);
const fs = require('fs');
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
		extra: {error: data}
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

function checkAllBalances() {
	var totalBal = 0;
	for(var acctNum in web3.eth.accounts) {
		var acct = web3.eth.accounts[acctNum];
		var acctBal = web3.fromWei(web3.eth.getBalance(acct), "ether");
		totalBal += parseFloat(acctBal);
		if(acctBal > 0) {
			console.log("  eth.accounts[" + acctNum + "]: \t" + acct + " \tbalance: " + acctBal + " ether");
			
			try {
				ethRPC.personal.unlockAccount(acct, ethPassword);
				logger.info('success unlock');
			} catch(error) {
				logger.error('[processTransaction][unlock account] : ', error);
			}
		}
		
	}
	console.log("  Total balance: " + totalBal + " ether");
}
checkAllBalances();
return;

class Processor {
	
	constructor() {
		this.models = [];
		this.lastProcessedBlockIndex = null;
		this.CrowdSaleContract = null;
		
		async.waterfall([
			(cb) => {
				require(`${RootDir}App/Controllers/modelsWrapper`)((err, mongoModels) => {
					if(err) {
						logger.error("Error in init models:", err);
						return cb(err);
					}
					
					this.models = mongoModels;
					cb();
				});
			},
			(cb) => {
				this.models.settings.get('last_processed_eth_block', (err, result) => {
					this.lastProcessedBlockIndex = parseInt(result || config['ethereum']['firstBlockForProcessing'] || 0);
					cb();
				});
			},
			(cb) => {
				this.CrowdSaleContract = require(`${RootDir}App/Contracts/crowdsale.simple`);
				return cb();
			},
			(cb) => {
				this.processGlobal(cb);
			}
		], (error, result) => {
			console.log("done");
		});
	}
	
	getTokenPrice(amountEth) {
		let contract = ethRPC.eth.contract(abe).at(config['ethereum']['crowdSaleContractAddress']);
		// let amountRaised = contract.amountRaised() / 1000000000000000000;
		let currentStage = contract.currentStage().toString();
		
		switch(true) {
			case (currentStage == '0' && parseFloat(amountEth) >= 2500):
				return 0.0075;
			case (currentStage == '0' && parseFloat(amountEth) < 2500):
			case currentStage == '1':
				return 0.0085;
			case currentStage == '2':
				return 0.009;
			case currentStage == '3':
				return 0.01;
		}
	}
	
	processGlobal() {
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
			(callback) => {
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
	
	processBlock(callback) {
		let currentBlock = ethRPC.eth.getBlock(this.currentBlockIndex + 1);
		this.lastProcessedBlockIndex = this.currentBlockIndex + 1;
		
		if(!currentBlock || !currentBlock.number || !currentBlock.transactions || !Array.isArray(currentBlock.transactions)) {
			return callback();
		}
		
		this.currentBlockIndex = currentBlock.number;
		
		logger.info(`Start processed block ${this.currentBlockIndex} with ${currentBlock.transactions.length} transactions`);
		
		async.each(currentBlock.transactions, (txHash, next) => {
			this.processTransaction(txHash, next)
		}, (error) => {
			if(error) {
				this.lastProcessedBlockIndex = this.currentBlockIndex - 1;
				this.models.settings.set('last_processed_eth_block', this.lastProcessedBlockIndex);
				
				logger.error('[processBlock][result] : ', error);
				return callback(error);
			}
			
			this.models.settings.set('last_processed_eth_block', this.lastProcessedBlockIndex, (error) => {
				if(error) {
					logger.error('[processBlock][set settings] : ', error);
					return callback(error);
				}
				
				callback();
			});
		});
	}
	
	processTransaction(txHash, callback) {
		let currentTransaction = ethRPC.eth.getTransaction(txHash);
		
		if(!currentTransaction || !currentTransaction.to || !currentTransaction.value)
			return callback();
		
		let address = currentTransaction.to.toString();
		
		async.waterfall([
			(cb) => {
				this.models.users.findOne({address}, (error, user) => {
					if(error) {
						logger.error('[processTransaction][fetch user] : ', error);
						return cb(error, null);
					}
					return cb(null, user);
				});
			},
			(user, cb) => {
				if(!user) {
					return cb(null, null, null);
				}
				this.models.transactions.findOne({txHash}, (error, transaction) => {
					if(error) {
						logger.error('[processTransaction][fetch transaction] : ', error);
						return cb(error, null, null);
					}
					
					return cb(null, user, transaction);
				});
			},
			(user, transaction, cb) => {
				if(!user || transaction) {
					return cb();
				}
				
				let gas = 400000,
					userId = user._id,
					maxCommission = ethRPC.fromWei(gas * ethRPC.eth.gasPrice, 'ether'),
					maxCommissionInWei = parseInt(ethRPC.toWei(maxCommission, 'ether')),
					amount = ethRPC.fromWei(currentTransaction.value, 'ether').toNumber(),
					amountInWei = parseInt(ethRPC.toWei(amount, 'ether')),
					tokenPrice = this.getTokenPrice(parseFloat(amount) ? parseFloat(amount) : 0),
					resultAmount = (amount - maxCommission) / tokenPrice;
				
				let balance = ethRPC.eth.getBalance(user.address);
				
				if(parseInt(balance) < parseInt(amountInWei)) {
					amountInWei = parseInt(balance);
				}
				
				if(amountInWei < maxCommissionInWei) {
					sendWarning('Invalid balance', {
						amount: ethRPC.toWei(amount, 'ether'),
						balance: balance,
						comission: maxCommissionInWei
					});
					return cb();
				}
				
				try {
					ethRPC.personal.unlockAccount(user.address, ethPassword);
				} catch(error) {
					if(error) {
						logger.error('[processTransaction][unlock account] : ', error);
						return cb(error);
					}
				}
				
				async.waterfall([
					cb => {
						if(config['ethereum']['preSaleEndTime'] < Date.now() / 1000)
							return cb(null, config['ethereum']['crowdSaleContractAddress']);
						
						let resultAmountInEth = parseFloat(ethRPC.fromWei(amountInWei - ethRPC.toWei(maxCommission, 'ether'), 'ether'));
						if(user.preSaleAddress)
							return cb(null, user.preSaleAddress);
						
						if(resultAmountInEth < 0.5)
							return cb(null, config['ethereum']['preSaleContractAddress']);
						
						// try {
						// 	ethRPC.personal.unlockAccount(config['ethereum']['public_key'], ethPassword);
						// } catch(error) {
						// 	if(error) {
						// 		logger.error('[processTransaction][unlock main account] : ', error);
						// 		return cb(error);
						// 	}
						// }
						amountInWei = amountInWei - 900000;
						this.CrowdSaleContract.createPresale(user.address, (err, presaleAddress) => {
							user.preSaleAddress = presaleAddress;
							user.save();
							cb(null, presaleAddress);
						});
					},
					(recipient, cb) => {
						let tx = {
							from: user.address,
							to: recipient,
							value: amountInWei - ethRPC.toWei(maxCommission, 'ether'),
							gas: gas
						};
						logger.info('[processTransaction][send transaction] : ', tx);
						return cb(null, tx);
						
					},
					(data, cb) => {
						ethRPC.eth.sendTransaction(data, (error, crowdSaleTxHash) => {
							logger.info('[processTransaction][transaction hash] : ', crowdSaleTxHash);
							
							if(error) {
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
								if(error) {
									logger.error('[processTransaction][create transaction] : ', error);
									return cb(error);
								}
								
								return cb();
							});
						});
					}
				], cb);
			}
		], (error, result) => {
			if(error) {
				logger.error('[processTransaction][result] : ', error);
				return callback(error)
			}
			
			callback();
		});
	}
}

new Processor();
