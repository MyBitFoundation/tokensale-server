"use strict";

let passport = require('passport'),
	LocalStrategy = require('passport-local').Strategy,
	passwordHash = require('password-hash'),
	async = require('async'),
	moment = require('moment'),
	logger = require('log4js').getLogger(),
	twoFactor = require('node-2fa');

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
			done(null, user._id);
		});
		
		passport.deserializeUser(function(user, done) {
			Models.users.findById(user, (err, User) => done(err, User));
		});
	},
	login: (cb, data) => {
		let {req, res, _post} = data;
		
		passport.authenticate('local', (err, user) => {
			if(err) {
				return cb(err);
			}
			if(!user) {
				return cb('Invalid username or password');
			}
			
			if(user.tfa) {
				if(!_post.token) {
					return cb('Two factor auth token required', 406);
				}
				
				let verification = twoFactor.verifyToken(user.secret, _post.token);
				
				if(!verification || !verification.hasOwnProperty('delta') || verification.delta != 0) {
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
					
					return Controllers.authority.info(cb, data);
				});
			});
		})(req, res, cb);
	},
	logout: (cb, data) => {
		data.req.logout();
		cb();
	},
	info(cb, data) {
		let User = data.req.user;

		let {email, tfa, lastLoginDate} = User;
		
		if(!User._id)
			return cb('Unknown error');
		
		let tokenPrice = Controllers.crowdsale.getTokenPrice();
		let amountRaised = Contracts.crowdsale.amountRaised || 0;
		let amountRaisedEUR = (
			tokenPrice &&
			amountRaised &&
			Controllers.crowdsale.ratesData &&
			Controllers.crowdsale.ratesData.fiat &&
			Controllers.crowdsale.ratesData.fiat['EUR']
		) ? parseFloat(Controllers.crowdsale.ratesData.fiat['EUR'] / tokenPrice * amountRaised).toFixed(6) : 0;
		
		cb(null, {
			email: email,
			balance: parseFloat(User.balance) + parseFloat(User.presetBalance),
			address: User.address,
			tfa: tfa,
			lastLoginDate: lastLoginDate,
			tokenPrice: (1 / Controllers.crowdsale.getTokenPrice()).toFixed(6),
			precision: Contracts.token.precision,
			endTime: Contracts.crowdsale.endDate,
			deadline: Contracts.crowdsale.deadline,
			presaleDeadline: Contracts.crowdsale.presaleDeadline,
			contractAddress: Contracts.crowdsale.address,
			amountRaised: amountRaised,
			amountRaisedEUR: amountRaisedEUR,
			referralKey: User.referralParams.inviteCode
		});
	}
};

Controllers.authority = AuthorityController;

module.exports = () => {
	AuthorityController.initialize();
};