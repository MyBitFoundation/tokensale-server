const logger = require('log4js').getLogger('App/Repositories/exchangeTransactions'),
	async = require('async'),
	raven = require('../Helpers/raven.helper');

let Helpers = {
	changelly: require('../Helpers/changelly')
};

let Models = {
	exchangeTransactions: require('../Models/exchangeTransactions')
};

class ExchangeTransactionsRepository {
	
	static getNew(user, currency, cb) {
		Models.exchangeTransactions.findOne({
			userId: user._id,
			currency: currency.toUpperCase()
		}, (err, Exist) => {
			if(err) return raven.error(err, '1500203395003', cb);
			if(Exist) return cb(null, {
				address: Exist.depositAddress,
				extra: Exist.extraInfo
			});
			
			Helpers.changelly.generateAddress(currency, 'eth', user.generatedAddress, (err, response) => {
				logger.info(response);
				
				if(err) return raven.error(err, '1500199437067', cb);
				
				Models.exchangeTransactions.create({
					orderId: response.id,
					userId: user._id,
					depositAddress: response.result.address,
					destinationAddress: user.generatedAddress,
					extraInfo: response.result.extraId,
					currency: currency.toUpperCase(),
					isClosed: false,
					executedAt: null
				}, (err, Tx) => {
					if(err) return raven.error(err, '1500199671218', cb);
					return cb(null, {
						address: Tx.depositAddress,
						extra: Tx.extraInfo
					});
				});
			});
		});
	}
	
	static getWait(cb) {
		Models.exchangeTransactions.find((err, List) => {
			if(err) return raven.error(err, '1500202393563', cb);
			
			return cb(null, List);
		});
	}
}

module.exports = ExchangeTransactionsRepository;