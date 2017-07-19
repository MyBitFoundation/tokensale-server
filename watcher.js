const raven = require('./App/Helpers/raven.helper'),
	logger = require('log4js').getLogger('watcher'),
	models = require('./App/Controllers/modelsWrapper')();

let Helper = {
	etehreum: require('./App/Helpers/ethereum.helper')
};
let Watchers = {
	exchange: require('./App/Watchers/exchange.watcher'),
	contract: require('./App/Watchers/contract.watcher')
};


class Watcher {
	
	constructor() {
		raven.initialize();
		// this.startFundTransferWatcher();
		
		Watchers.exchange.startWatcher();
		Watchers.contract.startWatcher();
	}
	
	startFundTransferWatcher() {
	}
}

new Watcher();