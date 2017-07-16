const request = require('request'),
	logger = require('log4js').getLogger('App/cron/price'),
	cron = require('node-cron');

let Repositories = {
	settings: require('../Repositories/settings.repository')
};

class Price {
	constructor() {
		this.ethPrice = 0;
		
		Repositories.settings.get('eth_price', (err, Price) => {
			if(Price)
				this.ethPrice = Price;
		});
		
		cron.schedule('*/10 * * * *', () => this.tick(), true);
		this.tick();
	}
	
	tick() {
		request.get(`https://api.coinmarketcap.com/v1/ticker/ethereum/`, (err, res) => {
			if(err) {
				logger.error("Error get price", `https://api.coinmarketcap.com/v1/ticker/ethereum/`);
				logger.error(err);
				return;
			}
			let data = null;
			try {
				data = JSON.parse(res.body);
			} catch(e) {
				return;
			}
			
			this.ethPrice = data[0].price_usd;
			
			Repositories.settings.set('eth_price', this.ethPrice, () => {});
		});
	}
}

module.exports = new Price();
