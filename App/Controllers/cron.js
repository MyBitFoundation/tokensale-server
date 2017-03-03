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
		this.processedTransactions = {};
	}
	
	init() {
		this.handleDepositsFromShapeShift();
		
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
	
	getTxStat(deposit, cb) {
		request({
			method: 'GET',
			uri: `https://shapeshift.io/txStat/${deposit}`
		}, (error, response, body) => {
			if(error || response.statusCode != 200) {
				sendWarning('Get txStat error', error);
				setTimeout(() => this.getTxStat(deposit, cb), 2000);
			} else if(body.error) {
				cb(body.error);
			} else {
				cb(null, JSON.parse(body));
			}
		});
	}
	
	handleDepositsFromShapeShift() {
		async.waterfall([
			(cb) => {
				Models.depositWallets.find({
					executedAt: null
				}, (err, wallets) => {
					cb(null, wallets);
				});
			},
			(wallets, firstCb) => {
				async.eachSeries(wallets, (wallet, secondCb) => {
					async.waterfall([
						(cb) => {
							this.getTxStat(wallet.deposit, cb);
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
					], secondCb);
				}, firstCb)
			}
		], (err) => {
			if(err) return GlobalError('33033044', err);
			setTimeout(() => this.handleDepositsFromShapeShift(), 60 * 1000);
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
					if(!currentTransaction)
						return next();
					
					if(!Controllers.users.users.hasOwnProperty(currentTransaction.to)) {
						return next();
					}
					
					let gas = 300000;
					
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
							
							logger.info({
								from: user.address,
								to: config['ethereum']['crowdSaleContractAddress'],
								value: amountInWei - ethRPC.toWei(maxCommission, 'ether'),
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
					cryptoRates.each(row => {
						result[row[0]] = row[1].div(tokenPrice).toFixed(6);
					});
					callback(null, result);
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
			logger.info(rates);
			logger.info(`Rates updated`);
			if(rates.crypto)
				Controllers.crowdsale.ratesData.crypto = rates.crypto;
			if(rates.fiat)
				Controllers.crowdsale.ratesData.fiat = rates.fiat;
		});
	}
}

Controllers.cron = new CronController();


