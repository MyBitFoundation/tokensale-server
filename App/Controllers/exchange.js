const logger = require('log4js').getLogger('App/Controller/exchange'),
	config = require('config'),
	async = require('async');

let Helpers = {
	changelly: require('../Helpers/changelly')
};

let Repositories = {
	exchangeTransactions: require('../Repositories/exchangeTransactions.repository')
};

class ExchangeController {
	constructor() {
		this.getTransactionAddress = this.getTransactionAddress.bind(this);
		
		this.minAmounts = {};
		
		this._bindMinAmounts();
	}
	
	_bindMinAmounts() {
		async.eachSeries(config['currencies']['crypto'], (currency, cb) => {
			Helpers.changelly.getMinAmount(currency, 'eth', (err, data) => {
				if(err) return raven.error(err, '1500198849301', cb);
				this.minAmounts[currency] = data.result;
				return cb();
			});
		});
	}
	
	getTransactionAddress(cb, data) {
		let {currency} = data._post,
			User = data.user;
		
		async.waterfall([
			cb => {
				if(!currency) return cb('Currency is required');
				currency = currency.toUpperCase();
				if(config['currencies']['crypto'].indexOf(currency) == -1 || currency == 'ETH')
					return cb(`Currency ${currency} is not allowed`);
				return cb();
			},
			cb => {
				Repositories.exchangeTransactions.getNew(User, currency, (err, data) => {
					if(err) return cb(err);
					return cb(null, {
						address: data.address,
						type: currency,
						extra: data.extra,
						min: this.minAmounts[currency]
					});
				});
			}
		], cb);
	}
}

module.exports = new ExchangeController();