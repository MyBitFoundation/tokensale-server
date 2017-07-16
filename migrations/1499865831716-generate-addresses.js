'use strict';
let config = require('config')['db'];
const mongoose = require('mongoose');
let userUrl = (config['user']) ? (config['user'] + ':' + config['password'] + '@') : '';
let url = 'mongodb://' + userUrl + config['host'] + ':' + config['port'] + '/' + config['database'];
// mongoose.Promise = require('bluebird');
// mongoose.connect(url, function(err, db) {});

const async = require('async');

let Helpers = {
	ethereum: require('../App/Helpers/ethereum.helper')
};

let Models = {
	user: require('../App/Models/users'),
};

exports.up = function(next) {
	Models.user.find({
		generatedAddress: {$exists: false}
	}, (err, List) => {
		async.eachSeries(List, (User, next) => {
			User.generatedAddress = Helpers.ethereum.generateNewAddress();
			User.save(() => next());
		}, next);
	});
};

exports.down = function(next) {
	next();
};
