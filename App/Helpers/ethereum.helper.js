const Web3 = require('web3'),
	logger = require('log4js').getLogger('App/Helper/ethereum.helper'),
	config = require('config'),
	fs = require('fs'),
	raven = require('../Helpers/raven.helper');

class EthereumHelper {
	
	constructor() {
		if(!fs.existsSync(__dirname + '/../../password')) {
			logger.error("File with password not found. Please create password file in root folder");
			process.exit(1);
		}
		global.ethPassword = fs.readFileSync(__dirname + '/../../password').toString();
		logger.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
		logger.error("!!!! Don't forget remove file with password !!!!");
		logger.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
		
		if(!config['ethereum']['rpc_enabled'])
			return logger.warn('Ethereum RPC disabled');
		this.web3 = new Web3(new Web3.providers.HttpProvider(config['ethereum']['rpc']));
		
		logger.info(`Ethereum is connected - ${this.web3.isConnected() ? 'true' : 'false'}`);
		
		this.password = ethPassword;
		this.generateNewAddress = this.generateNewAddress.bind(this);
	}
	
	generateNewAddress() {
		if(!config['ethereum']['rpc_enabled'])
			return "";
		return this.web3.personal.newAccount(this.password);
	}
	
	/**
	 *
	 * @param fromAddress
	 * @param amount - amount with fee in eth
	 * @param cb
	 */
	sendToCrowdsale(fromAddress, amount, cb) {
		amount = this.web3.toWei(amount);
		this.unlock(fromAddress, err => {
			if(err) return cb(err);
			
			let transactionObject = {
				from: fromAddress,
				to: config['ethereum']['crowdSaleContractAddress'],
				gasPrice: this.web3.eth.gasPrice
			};
			let transactionFee = transactionObject.gasPrice * config['ethereum']['gas'];
			transactionObject.value = amount - transactionFee;
			transactionObject.gas = config['ethereum']['gas'] - 1;
			logger.info(`New transaction to CrwodSale contract`);
			logger.info(transactionObject);
			logger.info(this.web3.fromWei(transactionFee));
			this.web3.eth.sendTransaction(transactionObject, (err, transactionHash) => {
				if(err) return raven.error(err, '1500204447193', cb);
				return cb(null, {
					transactionHash,
					amount: this.web3.fromWei(transactionObject.value, 'ether')
				});
			});
		});
	}
	
	unlock(address, cb) {
		try {
			this.web3.personal.unlockAccount(address, this.password);
		} catch(e) {
			try {
				this.web3.personal.unlockAccount(address, "");
			} catch(e) {
				return raven.error(new Error(`Invalid password for account ${address}`), '1500204561285', cb);
			}
		}
		return cb();
	}
}

module.exports = new EthereumHelper();