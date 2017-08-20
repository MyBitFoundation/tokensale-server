const async = require('async'),
	logger = require('log4js').getLogger('App/Controllers/token'),
	raven = require('../Helpers/raven.helper'),
	passwordHash = require('password-hash'),
	config = require('config'),
	BigNumber = require('bignumber.js'),
	twoFactor = require('node-2fa');

let Controllers = getControllers(),
	Contracts = getContracts();
let Helpers = {
	ethereum: require('../Helpers/ethereum.helper')
};
const Repositories = {
	withdraw: require('../Repositories/withdraw.repository')
};

class Tokens {
	constructor() {
		this.runIterate();
	}
	
	runIterate() {
		async.waterfall([
			cb => this.checkNewTransactions(cb),
			cb => this.checkProcessed(cb)
		], () => {
			setTimeout(() => this.runIterate(), 1000 * 30);
		});
	}
	
	withdraw(cb, data) {
		let {user} = data,
			{address, password, tfaKey} = data.req.form;
		
		if(!passwordHash.verify(password, user.password)) {
			return cb({password: ['Invalid password']});
		}
		
		if(user.balanceForWithdraw == 0) {
			return cb(null, {
				address: ['Not tokens for withdraw']
			});
		}
		if(Contracts.token.contract.balanceOf(user.generatedAddress) == 0) {
			return cb(null, {
				address: ['Not tokens for withdraw']
			});
		}
		
		if(user.tfa) {
			if(!tfaKey) {
				return cb({tfaKey: ['Two factor auth token required']});
			}
			
			let verification = twoFactor.verifyToken(user.secret, tfaKey);
			
			if(!verification || !verification.hasOwnProperty('delta') || verification.delta != 0) {
				return cb({tfaKey: ['Two factor auth token is not correct']});
			}
		}
		
		let ip = data.req.headers['x-forwarded-for'] || data.req.connection.remoteAddress;
		if(ip) {
			ip = ip.replace(/,.*/, '');
		}
		Repositories.withdraw.addNew(user, address, ip, (err) => {
			if(err) return cb(err);
			user.balance -= user.balanceForWithdraw / Contracts.token.precision;
			user.balanceForWithdraw = 0;
			user.save(err => {
				Controllers.authority.info(cb, data);
			});
		});
	}
	
	checkNewTransactions(cb) {
		Repositories.withdraw.findByStatus('new', (err, List) => {
			if(!List.length) return cb();
			async.eachSeries(List, (Row, cb) => {
				let estimateGas = Contracts.token.estimateTransfer(Row.fromAddress, Row.toAddress),
					balance = Helpers.ethereum.web3.eth.getBalance(Row.fromAddress),
					gasPrice = Helpers.ethereum.web3.eth.gasPrice;
				
				let estimate = new BigNumber(estimateGas).times(gasPrice);
				// logger.info({
				// 	estimateGas,
				// 	balance: Helpers.ethereum.web3.fromWei(balance),
				// 	gasPrice: Helpers.ethereum.web3.fromWei(gasPrice),
				// 	wait: estimate.minus(balance).toNumber()
				// });
				
				if(balance.greaterThanOrEqualTo(estimate)) {
					return this.sendTokens(Row, gasPrice, estimateGas, cb);
				} else {
					return this.sendEth(Row, estimate.minus(balance), gasPrice, estimateGas, cb);
				}
			}, (err) => cb(err));
		});
	}
	
	sendTokens(WithdrawRow, gasPrice, gasLimit, cb) {
		Helpers.ethereum.unlock(WithdrawRow.fromAddress, (err) => {
			if(err) {
				WithdrawRow.status = 'error';
				return WithdrawRow.save(err => cb());
			}
			Contracts.token.sendTokens(WithdrawRow.fromAddress, WithdrawRow.toAddress, gasPrice, gasLimit, (err, result) => {
				if(err) {
					WithdrawRow.status = 'error';
					return WithdrawRow.save(err => cb());
				}
				let {amount, TxHash} = result;
				
				logger.info(`Send ${new BigNumber(amount).div(Contracts.token.precision).toString()} MYB from ${WithdrawRow.fromAddress} to ${WithdrawRow.toAddress}. TxHash - ${TxHash}`);
				
				WithdrawRow.status = 'processed';
				WithdrawRow.tokenTransactionHash = TxHash;
				WithdrawRow.amount = amount;
				return WithdrawRow.save(err => cb());
			});
		});
	}
	
	sendEth(WithdrawRow, waitEthAmount, gasPrice, gasLimit, cb) {
		Helpers.ethereum.unlock(config['ethereum']['master']['address'], (err) => {
			if(err) {
				WithdrawRow.status = 'error';
				return WithdrawRow.save(err => cb());
			}
			
			Helpers.ethereum.web3.eth.sendTransaction({
				to: WithdrawRow.fromAddress,
				from: config['ethereum']['master']['address'],
				value: waitEthAmount
			}, (err, TxHash) => {
				
				logger.info(`Send ${Helpers.ethereum.web3.fromWei(waitEthAmount)} ETH to ${WithdrawRow.fromAddress}. TxHash - ${TxHash}`);
				
				WithdrawRow.status = 'wait_eth';
				WithdrawRow.gasPrice = gasPrice;
				WithdrawRow.gasLimit = gasLimit;
				WithdrawRow.ethTransactionHash = TxHash;
				return WithdrawRow.save(err => cb());
			});
			
		}, config['ethereum']['master']['password']);
	}
	
	checkProcessed(cb) {
		async.waterfall([
			cb => {
				Repositories.withdraw.findByStatus('processed', (err, List) => {
					if(!List.length) return cb();
					async.eachSeries(List, (Row, cb) => {
						let transaction = Helpers.ethereum.web3.eth.getTransaction(Row.tokenTransactionHash);
						if(!transaction || !transaction.blockNumber) return cb();
						Row.status = 'completed';
						Row.save(err => cb());
					}, () => cb());
				});
			},
			cb => {
				Repositories.withdraw.findByStatus('wait_eth', (err, List) => {
					if(!List.length) return cb();
					async.eachSeries(List, (Row, cb) => {
						let transaction = Helpers.ethereum.web3.eth.getTransaction(Row.ethTransactionHash);
						if(!transaction || !transaction.blockNumber) return cb();
						
						this.sendTokens(Row, Row.gasPrice, Row.gasLimit, cb);
					}, () => cb());
				});
			}
		], (err) => cb());
	}
}

Controllers.tokens = new Tokens();