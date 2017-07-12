'use strict';
let config = require('config')['db'];
const mongoose = require('mongoose');
let userUrl = (config['user']) ? (config['user'] + ':' + config['password'] + '@') : '';
let url = 'mongodb://' + userUrl + config['host'] + ':' + config['port'] + '/' + config['database'];
mongoose.Promise = require('bluebird');
mongoose.connect(url, function(err, db) {});

const async = require('async');

let Models = {
	user: require('../App/Models/users'),
};

exports.up = function(next) {
	Models.user.find({
		referralParams: {$exists: false}
	}, (err, List) => {
		async.eachSeries(List, (User, next) => {
			User.save(() => next());
		}, next);
	});
};

exports.down = function(next) {
	next();
};
