"use strict";

let abe = require('./token.abe.json');

let logger = require('log4js').getLogger('Token Contract'),
	config = require(ConfigPath);

let Contracts = getContracts();
let Models = getModels();

class TokenContract {
	
	constructor() {
		
		if(!config['ethereum']['rpc_enabled'])
			return;
		
		this.initIteration = 0;
	
		this.initialize();
	}
	
	initialize() {
		if(this.initIteration > 3) {
			sendWarning('TockenContract not initialized', {Contracts});
		}
		if(!Contracts.crowdsale || !Contracts.crowdsale.tokenRewardAddress) {
			Contracts = getContracts();
			this.initIteration++;
			
			return setTimeout(this.initialize(), 1000);
		}
		this.address = Contracts.crowdsale.tokenRewardAddress;
		this.contract = ethRPC.eth.contract(abe).at(this.address);
		this.precision = Math.pow(10, this.contract.decimals());
		Models.settings.get('last_block_with_token_log', (err, block) => {
			this.startEventsWatcher(parseInt((block || config['ethereum']['firstBlockForProcessing'])) + 1);
		});
	}
	
	startEventsWatcher(firstBlock) {
		logger.info('firstBlock', firstBlock);
		let filter = ethRPC.eth.filter({
			fromBlock: firstBlock,
			toBlock: 'latest',
			address: this.address
		});
		logger.info('Start watch');
		filter.watch((error, result) => {
			if(result['topics'][0] != '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef')
				return;
			let fromAddress = result['topics'][1].replace(/^0x000000000000000000000000/, '0x');
			if(fromAddress == '0x0000000000000000000000000000000000000000')
				return;
			let toAddress = result['topics'][2].replace(/^0x000000000000000000000000/, '0x');
			
			logger.info(`Send token to ${toAddress} address`);
			
			Models.users.findOne({address: toAddress}, (err, User) => {
				if(!User) return;
				User.balance = parseInt(this.contract.balanceOf(toAddress))/this.precision;
				return User.save();
			});
			Models.settings.set('last_block_with_token_log', result.blockNumber);
		});
		
	}
}

Contracts.token = new TokenContract();