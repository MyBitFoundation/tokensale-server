const logger = require('log4js').getLogger('App/Watcher/contract.watcher'),
	raven = require('../Helpers/raven.helper');

let Helper = {
	ethereum: require('../Helpers/ethereum.helper')
};
let Contracts = {
	crowdsale: require('../Contracts/crowdsale')
};
let Repositories = {
	history: require('../Repositories/history.repository')
};

class ContractWatcher {
	startWatcher() {
		Contracts.crowdsale.setFoundTransferCallback((err, log) => {
			if(err) return raven.error(err, '1500136461703');
			this.newLog(log);
		});
	}
	
	newLog(Obj) {
		let {address, amount, isContribution} = this.parseLogData(Obj.data);
		if(!isContribution) return;
		logger.info('Add new log');
		logger.info({
			address, amount,
			log: Obj
		});
		Repositories.history.newLog(null, address, amount, Obj.transactionHash, null, () => {});
	}
	
	parseLogData(data) {
		data = data.substr(2);
		
		let address = '0x' + data.substr(24, 39),
			amount = Helper.ethereum.web3.fromWei(Helper.ethereum.web3.toDecimal('0x' + data.substr(96, 32))),
			isContribution = data.slice(-1) == '1';
		return {address, amount, isContribution}
	}
}

module.exports = new ContractWatcher();