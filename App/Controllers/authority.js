"use strict";

let passport = require('passport'),
	LocalStrategy = require('passport-local').Strategy,
	passwordHash = require('password-hash'),
	async = require('async'),
	moment = require('moment'),
	logger = require('log4js').getLogger(),
    twoFactor = require('node-2fa'),
    ethHelper = require('../Components/eth');

let Controllers = getControllers(),
	Contracts = getContracts(),
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
		let  { req, res, _post } = data;

		passport.authenticate('local', (err, user) => {
			if(err) {
				return cb(err);
			}
			if(!user) {
				return cb('Invalid username or password');
			}

			if(user.tfa){
				if(!_post.token){
                    return cb('Two factor auth token required', 406);
				}

                let verification = twoFactor.verifyToken(user.secret, _post.token);

                if(!verification || !verification.hasOwnProperty('delta') || verification.delta != 0){
                    return cb('Two factor auth token is not correct', 406);
                }
			}

			user.lastLoginDate = moment().format();
			user.save(() => {
				user = user.toObject();
				req.logIn(user, function(err) {
					if(err) {
						logger.error(err);
						return cb('Login error');
					}
					
					return Controllers.authority.me(cb, data);
				});
			});
		})(req, res, cb);
	},
	logout: (cb, data) => {
		data.req.logout();
		cb();
	},
	me(cb, data) {
		let { email, balance, tfa, lastLoginDate, publicKey } = data.req.session.passport.user,
			address = ethHelper.addressFromPublic(publicKey);

		if(!data.req.session.passport.user._id)
			return cb('Unknown error');
		Models.users.findOne({_id: data.req.session.passport.user._id}, (err, User) => {
			if(!User) {
				logger.error(`Not found user ${data.user._id}`);
				return cb(`Unknown error`);
			}
			cb(null, {
				email,
				balance : parseFloat(User.balance),
				address : address ? address.slice(2) : null,
				tfa,
				lastLoginDate,
				tokenPrice : Controllers.crowdsale.getTokenPrice(),
				amountRaised : Contracts.crowdsale.amountRaised || 0
			});
		});
	}
};

Controllers.authority = AuthorityController;

module.exports = () => {
	AuthorityController.initialize();
};