const logger = require('log4js').getLogger('App/Repositories/settings.repository');

let Models = {
	settings: require('../Models/settings')
};

class SettingsRepository {
	
	static get(name, cb) {
		Models.settings.findOne({name}, (err, Row) => {
			if(err) {
				logger.error('settings.js 02.09.169:31', 'Error', err);
				return cb('Unknown error');
			}
			if(!Row) {
				return cb(null, null);
			}
			return cb(null, Row.value);
		});
	};
	
	static set(name, value, cb = () => {}) {
		Models.settings.update({name}, {name, value}, {upsert: true}, (err, result) => {
			if(err) return raven.error(err, '1500114129302', cb);
			return cb(err, result);
		});
	};
	
}

module.exports = SettingsRepository;