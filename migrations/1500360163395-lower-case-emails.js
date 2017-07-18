'use strict';

const async = require('async');

let Models = {
	user: require('../App/Models/users'),
};

exports.up = function(next) {
	Models.user.find((err, Users) => {
		async.eachSeries(Users, (User, next) => {
			User.email = User.email.toLowerCase();
			User.save((err) => next(err));
		}, next);
	});
};

exports.down = function(next) {
	next();
};
