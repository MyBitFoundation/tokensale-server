"use strict";

let abe = require('./token.abe.json');

let logger = require('log4js').getLogger('Token Contract'),
	config = require('config'),
	BigNumber = require('bignumber.js');

let Contracts = typeof getContracts !== 'undefined' ? getContracts() : {};
Contracts.crowdsale = require('./crowdsale');
let Helpers = {
	ethereum: require('../Helpers/ethereum.helper')
};
let Repositories = {
	settings: require('../Repositories/settings.repository')
};

class TokenContract {
	
	constructor() {
        this.precision = 1;

		if(!config['ethereum']['rpc_enabled'])
			return;
		
		this.initIteration = 0;
	
		this.initialize();
	}
	
	initialize() {
		if(this.initIteration > 3) {
			sendWarning('TokenContract not initialized', {Contracts});
		}
		if(!Contracts.crowdsale || !Contracts.crowdsale.tokenRewardAddress) {
			Contracts = getContracts();
			this.initIteration++;
			
			return setTimeout(() => this.initialize(), 1000);
		}
		this.address = Contracts.crowdsale.tokenRewardAddress;
		this.contract = Helpers.ethereum.web3.eth.contract(abe).at(this.address);
		this.precision = Math.pow(10, this.contract.decimals());
	}
	
	setTransferCallback(cb) {
		Repositories.settings.get('last_block_with_token_log', (err, block) => {
			let startBlock = parseInt((block || config['ethereum']['firstBlockForProcessing'])) + 1;
			logger.info(`Start watch from ${startBlock} block`);
			
			let filter = Helpers.ethereum.web3.eth.filter({
				address: [this.address],
				fromBlock: startBlock,
				toBlock: "latest"
			});
			
			filter.watch((err, result) => {
				cb(err, result);
				Repositories.settings.set('last_block_with_token_log', result.blockNumber);
			});
		});
	}
	
	getBalance(address) {
		return new BigNumber(this.contract.balanceOf(address) || 0).div(this.precision);
	}
}

let tokenContract = new TokenContract();
Contracts.token = tokenContract;
module.exports = tokenContract;