const async = require('async'),
	logger = require('log4js').getLogger('App/Watchers/exchange.watcher'),
	raven = require('../Helpers/raven.helper'),
	BigNumber = require('bignumber.js');

let Repositories = {
	exchangeTransactions: require('../Repositories/exchangeTransactions.repository'),
	history: require('../Repositories/history.repository')
};
let Helpers = {
	ethereum: require('../Helpers/ethereum.helper'),
	changelly: require('../Helpers/changelly')
};

class ExchangeWatcher {
	
	constructor() {}
	
	startWatcher() {
		this.runIterate(() => {
			setTimeout(() => this.startWatcher(), 5 * 60 * 1000);
		});
	}
	
	runIterate(cb) {
		logger.info('Run iterate');
		Repositories.exchangeTransactions.getWait((err, List) => {
			if(err) return cb(err);
			logger.info(`Founded ${List.length} waiting transactions`);
			
			async.eachSeries(List, (Wallet, cb) => {
				return this.checkChangellyTransaction(Wallet, cb);
			}, err => cb(err));
		});
	}
	
	checkChangellyTransaction(Wallet, cb) {
		let balance = Helpers.ethereum.web3.fromWei(Helpers.ethereum.web3.eth.getBalance(Wallet.destinationAddress), "ether");
		if(balance < 0.01) return cb();
		
		Helpers.changelly.getTransactions(10, undefined, undefined, Wallet.depositAddress, undefined, (err, result) => {
			let list = result.result;
			
			async.eachSeries(list, (ChangellyTx, cb) => {
				if(ChangellyTx.status != 'finished') return cb();
				
				Repositories.history.findByChangellyId(ChangellyTx.id, (err, Exist) => {
					if(err) return cb(err);
					if(Exist) return cb();
					
					logger.info('Changelly info', ChangellyTx);
					let amount = new BigNumber(ChangellyTx.amountTo).minus(ChangellyTx.networkFee);
					
					Helpers.ethereum.sendToCrowdsale(Wallet.destinationAddress, amount, (err, result) => {
						if(err) return cb(err);
						
						Repositories.history.newLog(Wallet.userId, Wallet.destinationAddress, result.amount, result.transactionHash, ChangellyTx, cb);
					});
				});
			});
		});
	}
}

module.exports = new ExchangeWatcher();