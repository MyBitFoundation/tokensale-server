const Raven = require('raven'),
	logger = require('log4js').getLogger('helper'),
	config = require('config');
class RavenHelper {
	static error(error, key, cb) {
		if(!config.raven.enabled) {
			logger.error(error);
			return cb('Error ' + key);
		}
		if(typeof error === 'object') {
			error = JSON.stringify(error);
		}
		if(typeof error === 'string') {
			Raven.captureMessage(error, (err, eventId) => {
				logger.error(error, key, eventId);
			});
		} else {
			Raven.captureException(error);
		}
		cb('Unknown error');
	}
}

module.exports = RavenHelper;
