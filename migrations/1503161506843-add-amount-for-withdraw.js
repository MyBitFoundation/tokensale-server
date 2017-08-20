'use strict';

const async = require('async');
require('../App/Controllers/modelsWrapper')(() => {});
let Models = {
	user: require('../App/Models/users'),
};
let contract = require('../App/Contracts/token');

exports.up = function(next) {
	Models.user.find({
		balance: {
			$gt: 0
		}
	}, (err, Users) => {
		async.eachSeries(Users, (User, cb) => {
			
			User.balanceForWithdraw = contract.contract.balanceOf(User.generatedAddress);
			console.log(`Balance ${User.email} = ${User.balanceForWithdraw / 100000000}`);
			Models.user.findByIdAndUpdate(User._id, {
				balanceForWithdraw: User.balanceForWithdraw
			}, err => {
				cb(err);
			});
		}, err => next(err));
	});
};

exports.down = function(next) {
	next();
};
