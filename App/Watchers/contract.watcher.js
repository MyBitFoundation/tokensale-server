const logger = require('log4js').getLogger('App/Watcher/contract.watcher'),
	raven = require('../Helpers/raven.helper');

let Helper = {
	ethereum: require('../Helpers/ethereum.helper')
};
let Contracts = {
	crowdsale: require('../Contracts/crowdsale'),
	token: require('../Contracts/token')
};
let Repositories = {
	history: require('../Repositories/history.repository'),
	users: require('../Repositories/users.repository')
};

class ContractWatcher {
	startWatcher() {
		Contracts.crowdsale.setFoundTransferCallback((err, log) => {
			if(err) return raven.error(err, '1500136461703');
			this.newLog(log);
		});
		Contracts.token.setTransferCallback((err, log) => {
			if(err) return raven.error(err, '1500136461704');
			this.newTransfer(log);
		});
	}
	
	newLog(Obj) {
		let {address, amount, isContribution} = this.parseFountLogData(Obj.data);
		if(!isContribution) return;
		logger.info('Add new log');
		logger.info({
			address, amount,
			log: Obj
		});
		Repositories.history.newLog(null, address, amount, Obj.transactionHash, null, () => {});
	}
	
	parseFountLogData(data) {
		data = data.substr(2);
		
		let address = '0x' + data.substr(24, 40),
			amount = Helper.ethereum.web3.fromWei(Helper.ethereum.web3.toDecimal('0x' + data.substr(96, 32))),
			isContribution = data.slice(-1) == '1';
		return {address, amount, isContribution}
	}
	
	newTransfer(Obj) {
		let fromAddress = '0x' + Obj.topics[1].substr(26, 40),
			toAddress = '0x' + Obj.topics[2].substr(26, 40);
		if(fromAddress == '0x0000000000000000000000000000000000000000')
			return;
		
		Repositories.users.updateBalance(fromAddress, () => {});
		Repositories.users.updateBalance(toAddress, () => {});
	}
}

module.exports = new ContractWatcher();