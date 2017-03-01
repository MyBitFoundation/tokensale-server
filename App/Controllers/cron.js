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
	ethHelper = require('../Components/eth');

let Controllers = getControllers(),
	Contracts = getContracts(),
	Models = getModels();

class CronController {
	
	constructor() {
		logger.info('Cron controller initialized');
		this.lastProcessedBlockIndex = 0;
	}
	
	init() {
		
		CronController.handleDeposits();
		cron.schedule('* * * * *', () => {
			CronController.handleDeposits();
		});
		
		//TODO only for tests.
		if(config['ethereum']['rpc_enabled']) {
			Models.settings.get('last_processed_eth_block', (err, result) => {
				this.lastProcessedBlockIndex = parseInt(result || config['ethereum']['firstBlockForProcessing']);
				
				this.handleETHDeposits();
			});
		}
		
		CronController.handleRates();
		cron.schedule('*/10 * * * *', () => {
			CronController.handleRates();
		});
	}
	
	static handleDeposits() {
		let tokenPrice = Controllers.crowdsale.getTokenPrice();
		
		async.waterfall([
			(cb) => {
				Models.depositWallets.find({
					executedAt: null
				}, (err, wallets) => {
					cb(null, wallets);
				});
			},
			(wallets, firstCb) => {
				async.each(wallets, (wallet, secondCb) => {
					async.waterfall([
						(cb) => {
							request({
								method: 'GET',
								uri: `https://shapeshift.io/txStat/${wallet.deposit}`
							}, (error, response, body) => {
								if(error || response.statusCode != 200) {
									cb('Api error');
								} else if(body.error) {
									cb(body.error);
								} else {
									cb(null, JSON.parse(body));
								}
							});
						},
						(result, cb) => {
							if(result.status != 'complete') {
								return cb(null, null, null);
							}
							
							//TODO only for tests.
							let maxCommission = ethRPC.fromWei(210000 * ethRPC.eth.gasPrice, 'ether'),
								incomeETH = parseFloat(result.outgoingCoin),
								resultETH = incomeETH - maxCommission,
								fundAmount = resultETH * tokenPrice;
							
							logger.info(`New executed transaction found. Deposit wallet id: ${wallet._id}`);
							
							wallet.executedAt = Date.now();
							wallet.transaction = {
								withdraw: result.withdraw,
								incomingCoin: result.incomingCoin,
								incomingType: result.incomingType,
								address: result.address,
								outgoingCoin: result.outgoingCoin,
								outgoingType: result.outgoingType,
								transaction: result.transaction,
								fundAmount: fundAmount
							};
							
							Models.users.findOne({
								_id: wallet.userId
							}, (err, user) => {
								if(err) return cb(err);
								
								cb(null, user, resultETH);
							});
						},
						(user, resultETH, cb) => {
							if(!user || resultETH === null) {
								return cb(null, null);
							}
							
							//TODO only for tests.
							if(config['ethereum']['rpc_enabled']) {
								ethRPC.personal.unlockAccount(user.address, ethPassword);
								
								ethRPC.eth.sendTransaction({
									from: user.address,
									to: config['ethereum']['crowdSaleContractAddress'].slice(2),
									value: ethRPC.toWei(resultETH, 'ether')
								}, (err, address) => {
									if(err) return cb(err);
									
									cb(null, user);
								});
							} else {
								cb(null, user)
							}
						},
						(user, cb) => {
							if(!user) {
								return cb(null, null);
							}
							
							user.balance = (user.balance + wallet.transaction.fundAmount);
							user.save((err, user) => {
								if(err) return cb(err);
								
								logger.info(`Fund user ${user._id} balance with ${wallet.transaction.fundAmount} finney`);
								cb(null, user);
							});
						},
						(user, cb) => {
							if(!user) {
								return cb();
							}
							
							wallet.save((err, wallet) => {
								return cb();
							});
						},
					], secondCb);
				}, firstCb)
			}
		], (err) => {
			if(err) return GlobalError('33033044', err);
		});
		
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
					
					if(!Controllers.users.users.hasOwnProperty(currentTransaction.to)) {
						return next();
					}
					
					let userId = Controllers.users.users[currentTransaction.to],
						// maxCommission = parseFloat(ethRPC.fromWei(ethRPC.eth.gasPrice, 'ether').toString(10)),
						maxCommission = ethRPC.fromWei(300000 * ethRPC.eth.gasPrice, 'ether'),
						amount = ethRPC.fromWei(currentTransaction.value, 'ether').toNumber(),
						resultAmount = tokenPrice * (amount - maxCommission);
					
					logger.info(maxCommission);
					logger.info(ethRPC.fromWei(ethRPC.eth.gasPrice, 'ether'));
					logger.info(ethRPC.toWei(amount, 'ether') - ethRPC.toWei(maxCommission, 'ether'));
					Models.depositWallets.findOne({orderId: currentTransaction.hash}, (err, wallet) => {
						if(wallet) {
							return next();
						}
						
						Models.users.findOne({_id: userId}, (err, user) => {
							if(err) return next(err);
							
							try {
								ethRPC.personal.unlockAccount(user.address, ethPassword);
							} catch(e) {
								return next(err);
							}
							
							logger.info({
								from: user.address,
								to: config['ethereum']['crowdSaleContractAddress'],
								value: ethRPC.toWei(amount, 'ether') - ethRPC.toWei(maxCommission, 'ether'),
								gas: parseInt(ethRPC.toWei(maxCommission / ethRPC.eth.gasPrice, 'ether'))
							});
							ethRPC.eth.sendTransaction({
								from: user.address,
								to: config['ethereum']['crowdSaleContractAddress'],
								value: ethRPC.toWei(amount, 'ether') - ethRPC.toWei(maxCommission, 'ether'),
								gas: parseInt(ethRPC.toWei(maxCommission / ethRPC.eth.gasPrice, 'ether'))
							}, (err, address) => {
								logger.info('tx', address);
								if(err) return next(err);
								logger.info(`New transaction from ${user.address} to contract`);
								
								Models.depositWallets.create({
									userId: userId,
									orderId: currentTransaction.hash,
									deposit: currentTransaction.to.slice(2),
									depositType: 'ETH',
									extraInfo: null,
									executed: true,
									executedAt: Date.now(),
									transaction: {
										withdraw: currentTransaction.hash,
										incomingCoin: amount,
										incomingType: 'ETH',
										address: user.address,
										outgoingCoin: amount,
										outgoingType: 'ETH',
										transaction: currentTransaction.hash,
										fundAmount: resultAmount,
										maxCommission: maxCommission,
										tokenPrice: tokenPrice
									},
								}, err => {
									if(err) {
										return next(err);
									}
									logger.info(`New ETH wallet created by user ${userId}`);
									return next();
									
									//TODO: Logic transferred to Contracts/token.js (update only after reward in contract)
									user.balance = parseFloat(user.balance) + resultAmount;
									user.save(err => {
										if(err) return next();
										logger.info(`Fund user ${user._id} balance with ${resultAmount} finney`);
										
										next();
									});
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
		
		let tokenPrice = Controllers.crowdsale.getTokenPrice();
		
		async.parallel({
			crypto: (callback) => {
				async.parallel(Object.keys(rates.crypto).map((key) => {
					return (cb) => {
						if(key == 'ETH') {
							return cb(null, {key, rate: new BigNumber(1)});
						}
						
						request({
							method: 'GET',
							uri: `https://shapeshift.io/rate/eth_${key.toLowerCase()}`
						}, (error, response, body) => {
							if(error || response.statusCode != 200) {
								cb('Api error');
							} else if(body.error) {
								cb(body.error);
							} else {
								let info = JSON.parse(body);
								
								if(!info.rate || !parseFloat(info.rate)) return cb('Api error');
								
								cb(null, {key, rate: new BigNumber(parseFloat(info.rate))});
							}
						});
					}
				}), (err, results) => {
					if(err) {
						return callback(err);
					}
					callback(null, Object.assign({}, ...results.map((info) => {
						return {[info.key]: info.rate.div(tokenPrice).toFixed(6)};
					})));
				});
			},
			fiat: (callback) => {
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
		}, (err, rates) => {
			logger.info(`Rates updated`);
			Controllers.crowdsale.ratesData = rates;
		});
	}
}

Controllers.cron = new CronController();


