let async = require('async'),
	logger = require('log4js').getLogger('App/Contracts/crowdsale'),
	config = require('config'),
	moment = require('moment'),
	abe = require('./crowdsale.abe.json'),
	cron = require('node-cron'),
	BigNumber = require('bignumber.js');

let Contracts = typeof getContracts !== 'undefined' ? getContracts() : {};
let Models = typeof getModels !== 'undefined' ? getModels() : {};

let Helpers = {
	ethereum: require('../Helpers/ethereum.helper')
};
let Repositories = {
	settings: require('../Repositories/settings.repository')
};

class CrowdsaleContract {
	
	constructor() {
		if(!config['ethereum']['rpc_enabled'])
			return;
		this.address = config.ethereum.crowdSaleContractAddress;
		this.contract = Helpers.ethereum.web3.eth.contract(abe).at(config.ethereum.crowdSaleContractAddress.toLocaleString());
		this.amountRaised = 0;
		this.currentStage = '0';
		this.currentPrice = '0';
		this.presaleDeadline = this.contract.presaleDeadline();
		this.endDate = moment(this.contract.deadline().toNumber(), 'X').format();
		this.deadline = this.contract.deadline();
		this.tokenRewardAddress = this.contract.tokenReward();
		this.bindData();
		cron.schedule('* * * * *', () => this.bindData(), true);
	}
	
	bindData() {
		this.amountRaised = Helpers.ethereum.web3.fromWei(this.contract.totalCollected());
		this.currentStage = this.contract.currentStage().toString();
		this.currentPrice = Helpers.ethereum.web3.fromWei(parseInt(this.contract.prices(this.currentStage)) * Math.pow(10, 8));
	}
	
	setFoundTransferCallback(cb) {
		Repositories.settings.get('last_block_with_crowdsale_log', (err, block) => {
			let startBlock = parseInt((block || config['ethereum']['firstBlockForProcessing'])) + 1;
			logger.info(`Start watch from ${startBlock} block`);
			
			let filter = Helpers.ethereum.web3.eth.filter({
				address: [config['ethereum']['crowdSaleContractAddress']],
				fromBlock: startBlock,
				toBlock: "latest"
			});
			
			filter.watch((err, result) => {
				cb(err, result);
				Repositories.settings.set('last_block_with_crowdsale_log', result.blockNumber);
			});
		});
	}
	
	getBalance(address) {
		try {
			return new BigNumber(Helpers.ethereum.web3.fromWei(this.contract.balanceOf(address)));
		} catch(e) {
			logger.error(e);
			return new BigNumber(0);
		}
	}
}

let crowdsale = new CrowdsaleContract();
Contracts.crowdsale = crowdsale;
module.exports = crowdsale;