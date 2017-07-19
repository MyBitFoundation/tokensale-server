const Raven = require('raven'),
	logger = require('log4js').getLogger('helper'),
	config = require('config');

class RavenHelper {
	static initialize() {
		if(config.raven.enabled) {
			logger.info('Configure raven');
			Raven.config(config.raven.config).install((e, d) => {
				logger.error(d);
				process.exit(1);
			});
		} else {
			logger.warn('Raven is disabled');
		}
	}
	
	static error(error, key, cb) {
		if(!config.raven.enabled) {
			logger.error(error);
			return cb('Error ' + key);
		}
		if(error instanceof Error) {
			Raven.captureException(error);
		} else {
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
		}
		
		cb('Unknown error');
	}
	
	static GlobalError(key, err, cb = () => {}) {
		logger.error(key, err);
		cb('Unknown error');
		if(Raven && !config['disableRaven']) {
			if(!(err instanceof Error)) {
				err = new Error(err);
			}
			err.key = key;
			Raven.captureException(err, {
				key: key
			});
		}
	};
	
	static sendWarning(message, data) {
		logger.warn(message, data);
		if(!Raven || config['disableRaven']) {
			return;
		}
		Raven.captureMessage(message, {
			level: 'warning',
			extra: { error: data }
		});
	};
}

module.exports = RavenHelper;
