const raven = require('./App/Helpers/raven.helper'),
	logger = require('log4js').getLogger('update-balance'),
	async = require('async'),
	models = require('./App/Controllers/modelsWrapper')();

let Repositories = {
	users: require('./App/Repositories/users.repository')
};


class Updater {
	
	constructor() {
		raven.initialize();
	}
	
	runIteration() {
		this.iterate(() => {
			setTimeout(() => this.runIteration(), 60 * 1000)
		});
	}
	
	iterate(cb) {
		Repositories.users.findAll((err, Users) => {
			if(err) return cb(err);
			async.eachSeries(Users, (User, cb) => {
				this.updateForUser(User, cb);
			});
		});
	}
	
	updateForUser(User, cb) {
		Repositories.users.updateBalance(User.generatedAddress, err => cb(err));
	}
}

new Updater();