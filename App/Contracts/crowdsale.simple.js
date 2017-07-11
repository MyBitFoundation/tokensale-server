let async = require('async'),
	logger = require('log4js').getLogger('CrowdSale Contract'),
	config = require('config'),
	abe = require('./crowdsale.abe.json');

class CrowdsaleContract {
	
	constructor() {
		this.contract = ethRPC.eth.contract(abe).at(config['ethereum']['crowdSaleContractAddress']);
	}
	
	createPresale(forAddress, cb) {
		return this.contract.createPresale(forAddress, {
			from: forAddress,
			gas: 900000
		}, (err, result) => {
			logger.info(err, result);
			let interval = setInterval(() => {
				let exist = this.contract.presaleContracts(forAddress);
				logger.info(exist);
				if(!exist || exist == '0x0000000000000000000000000000000000000000') return;
				
				clearInterval(interval);
				return cb(null, exist);
			}, 1000);
		});
	}
}

module.exports = new CrowdsaleContract();