"use strict";

let passport = require('passport'),
	LocalStrategy = require('passport-local').Strategy,
	passwordHash = require('password-hash'),
	async = require('async'),
	moment = require('moment'),
	logger = require('log4js').getLogger();

let Controllers = getControllers(),
	Models = getModels();

let AuthorityController = {
	initialize: function() {
		passport.use(new LocalStrategy({
				usernameField: 'email',
				passwordField: 'password'
			},
			function(email, password, cb) {
				async.waterfall([
					// find user and check is active status
					function(cb) {
						Models.users.findOne({
							email: email.toLowerCase()
						}, function(err, user) {
							if(err) {
								return cb(err);
							}
							if(!user) {
								return cb('Invalid username or password');
							}
							if(user.disabled) {
								return cb('User has been deactivated');
							}
							cb(null, user);
						});
					},
					// check user password
					function(User, cb) {
						// login user if password verified
						if(!passwordHash.verify(password, User.password)) {
							return cb('Invalid username or password');
						}
						return cb(null, User);
					}
				], cb);
			}
		));
		
		passport.serializeUser(function(user, done) {
			done(null, user);
		});
		
		passport.deserializeUser(function(user, done) {
			done(null, user);
		});
	},
	login: (cb, data) => {
		let req = data.req,
			res = data.res;
		passport.authenticate('local', (err, user) => {
			if(err) {
				return cb(err);
			}
			if(!user) {
				return cb('Invalid username or password');
			}
			user.lastLoginDate = moment().format();
			user.save();
			user = user.toObject();
			async.waterfall([
				function(cb) {
					req.logIn(user, function(err) {
						if(err) {
							console.log(err);
							return cb('Login error');
						}
						
						return cb(null, {
							email: user.email,
							lastLoginDate: user.lastLoginDate
						});
					});
				}
			], cb);
		})(req, res, cb);
	},
	logout: (cb, data) => {
		data.req.logout();
		cb();
	},
	me(cb, data) {
		let balance = data.req.user.balance ? parseFloat(data.req.user.balance) : 0;

		cb(null, {
			email: data.req.user.email,
            balance,
			lastLoginDate: data.req.user.lastLoginDate
		});
	}
};

Controllers.authority = AuthorityController;

module.exports = () => {
	AuthorityController.initialize();
};