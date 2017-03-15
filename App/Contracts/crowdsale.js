let async = require('async'),
	logger = require('log4js').getLogger('CrowdSale Contract'),
	config = require(ConfigPath),
	abe = require('./crowdsale.abe.json');

let Contracts = getContracts();
let Models = getModels();

class CrowdsaleContract {
	
	constructor() {
		this.contract = ethRPC.eth.contract(abe).at(config['ethereum']['crowdSaleContractAddress']);
		this.amountRaised = 0;

		if(!config['ethereum']['rpc_enabled'])
			return;
		this.tokenRewardAddress = this.contract.tokenReward();
		this.bindAmountRaised();

		Models.settings.get('last_block_with_crowdsale_log', (err, block) => {
			this.startEventsWatcher(parseInt((block || config['ethereum']['firstBlockForProcessing'])) + 1);
		});
	}
	
	bindAmountRaised() {
		this.amountRaised = this.contract.amountRaised() / 1000000000000000000;
	}
	
	startEventsWatcher(block) {
		let filter = ethRPC.eth.filter({
			fromBlock: block,
			toBlock: 'latest',
			address: config['ethereum']['crowdSaleContractAddress']
		});
		logger.info('Start watch');
		filter.watch((error, result) => {
			this.bindAmountRaised();
			let address = `0x${result.data.substring(26, 66)}`;
			logger.info(`New payment from ${address}`);
			Models.settings.set('last_block_with_crowdsale_log', result.blockNumber);
		});
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

Contracts.crowdsale = new CrowdsaleContract();
module.exports = Contracts.crowdsale;