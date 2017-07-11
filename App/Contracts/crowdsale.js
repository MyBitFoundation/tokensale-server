let async = require('async'),
	logger = require('log4js').getLogger('CrowdSale Contract'),
	config = require('config'),
	moment = require('moment'),
	abe = require('./crowdsale.abe.json');

let Contracts = getContracts();
let Models = getModels();

class CrowdsaleContract {
	
	constructor() {
		this.address = config.ethereum.crowdSaleContractAddress;
		this.contract = ethRPC.eth.contract(abe).at(config.ethereum.crowdSaleContractAddress);
		this.amountRaised = 0;
		this.currentStage = '0';
		this.currentPrice = '0';
		this.presaleDeadline = '0';
		this.endDate = null;
		this.deadline = null;

		if(!config['ethereum']['rpc_enabled'])
			return;

		this.tokenRewardAddress = this.contract.tokenReward();
		this.bindData();

		Models.settings.get('last_block_with_crowdsale_log', (err, block) => {
			this.startEventsWatcher(parseInt((block || config['ethereum']['firstBlockForProcessing'])) + 1);
		});
	}
	
	bindData() {
		this.amountRaised = ethRPC.fromWei(this.contract.totalCollected());
		this.currentStage = this.contract.currentStage().toString();
		this.endDate = moment(this.contract.deadline().toNumber(), 'X').format();
		this.currentPrice = ethRPC.fromWei(parseInt(this.contract.prices(this.currentStage)) * Math.pow(10, 8));
		this.presaleDeadline = this.contract.presaleDeadline();
		this.deadline = this.contract.deadline();
	}
	
	startEventsWatcher(block) {
		let filter = ethRPC.eth.filter({
			fromBlock: block,
			toBlock: 'latest',
			address: config['ethereum']['crowdSaleContractAddress']
		});
		logger.info('Start watch');
		filter.watch((error, result) => {
			this.bindData();
			let address = `0x${result.data.substring(26, 66)}`;
			logger.info(`New payment from ${address}`);
			Models.settings.set('last_block_with_crowdsale_log', result.blockNumber);
		});
	}
}

Contracts.crowdsale = new CrowdsaleContract();