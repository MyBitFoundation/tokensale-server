let request = require('request'),
	async = require('async'),
	logger = require('log4js').getLogger('Crowdsale Controller'),
	config = require('config'),
	moment = require('moment'),
	fx = require("money"),
	BigNumber = require('bignumber.js'),
	changelly = require('../Helpers/changelly');

fx.base = "USD";

let Controllers = getControllers(),
	Contracts = getContracts(),
	Models = getModels();

let Repositories = {
	history: require('../Repositories/history.repository')
};

class CrowdsaleController {
	
	constructor() {
		this.ratesData = {
			fiat: {},
			crypto: {}
		};
		logger.info('Crowdsale controller initialized');
	}
	
	getTokenPrice() {
		return Contracts.crowdsale.currentPrice;
	}
	
	transactions(cb, data) {
		let user = data.req.user;
		Repositories.history.getByAddresses([user.generatedAddress, user.address], (err, List) => {
			if(err) return cb(err);
			
			let result = [];
			List.forEach(Tx => {
				let amount = Tx.changellyInfo.id ? Tx.changellyInfo.amountFrom : Tx.amount;
				result.push({
					date: moment(Tx.createdAt).format('YYYY-MM-DD HH:mm:ss'),
					sentAmount: amount,
					sentCoinType: Tx.changellyInfo.id ? Tx.changellyInfo.currencyFrom.toUpperCase() : 'ETH',
					transactionId: Tx.transactionHash,
					address: Tx.address,
					receivedAmount: Tx.receivedTokens,
					tokenPrice: new BigNumber(Tx.receivedTokens).div(amount).toFixed(2)
				});
			});
			return cb(null, result);
		});
	}
	
	rates(callback, data) {
		callback(null, Controllers.crowdsale.ratesData);
	}
	
	exchangeAmount(callback, data) {
		let {currency, amount} = data._get;
		
		if(!currency) {
			return callback('Currency is required');
		}
		
		if(!amount) {
			return callback('Amount is required');
		}
		
		async.parallel({
			min: (cb) => {
				changelly.getMinAmount(currency, 'eth', function(error, data) {
					if(error)
						return cb('Changelly get min amount error: ' + error);
					
					if(data.error)
						return cb('Changelly get min amount error: ' + data.error.message);
					
					return cb(null, data.result);
				});
			},
			amount: (cb) => {
				changelly.getExchangeAmount(currency, 'eth', amount, function(error, data) {
					if(error)
						return cb('Changelly get exchange amount error: ' + error);
					
					if(data.error)
						return cb('Changelly get exchange amount error: ' + data.error.message);
					
					return cb(null, data.result * Controllers.crowdsale.getTokenPrice());
				});
			}
		}, (error, result) => {
			if(error) callback(error);
			
			callback(null, result);
		});
	}
}

Controllers.crowdsale = new CrowdsaleController();