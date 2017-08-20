"use strict";

let async = require('async'),
	passwordHash = require('password-hash'),
	logger = require('log4js').getLogger('Users Controller'),
	twoFactor = require('node-2fa'),
	config = require('config'),
	ethHelper = require('../Components/eth'),
	Mailchimp = require('mailchimp-api-v3'),
	mcAPI = new Mailchimp(config.mailchimp['api-key']);

let Controllers = getControllers(),
	Models = getModels();

let Repositories = {
	users: require('../Repositories/users.repository')
};

class UsersController {
	
	constructor() {
		this.users = {};
		logger.info('Users controller initialized');
	}
	
	init(callback) {
		callback();
	}
	
	registration(cb, data) {
		let {email, password, address, referrer_key} = data._post;
		
		async.waterfall([
			cb => {
				if(!referrer_key) return cb(null, null);
				Repositories.users.findOne({
					"referralParams.inviteCode": referrer_key
				}, (err, Referral) => {
					if(err) return cb(err);
					
					if(!Referral) return cb(null, null);
					return cb(null, Referral._id);
				});
			},
			(referrerId, cb) => {
				Repositories.users.create(email, password, address, referrerId, (err, User) => {
					if(err) return cb(err);
					
					logger.info(`User ${email} created`);
					
					mcAPI.post('/lists/' + config.mailchimp['id_subscriptions'] + '/members', {
						email_address: email,
						status: 'subscribed'
					}).then((results) => {
						logger.info(`Add user ${email} to subscribers`);
					}).catch((err) => {
						logger.warn(`Add user ${email} to subscribers error`, err);
					});
					cb(null, User, data);
				});
			},
			(User, data, cb) => {
				if(!User.address)
					return cb(null, data);
				Repositories.users.updateUserBalance(User, () => cb(null, data));
			},
			(data, cb) => {
				return Controllers.authority.login(cb, data);
			}
		], (err, result) => {
			if(err) {
				if(typeof err == 'string')
					err = {'email': [err]};
				return cb(err);
			}
			cb(null, result);
		});
	}
	
	changePassword(callback, data) {
		let {_post, req} = data;
		
		if(!_post.password_old) {
			return callback('Old password is required');
		}
		
		if(!_post.password_new) {
			return callback('New password is required');
		}
		
		if(_post.password_retype != _post.password_new) {
			return callback('New password does not match retyped password');
		}
		
		let {email, password} = req.user;
		let address = _post.address;
		
		if(address && !/^(0x)?[0-9a-fA-F]{40}$/i.test(address)) {
			return callback('Invalid address');
		}
		let needRecalculateBalance = false;
		Models.users.findOne({email}, (err, user) => {
			if(!user) return callback(`User with email ${email} is not exist`);
			
			if(!passwordHash.verify(_post.password_old, user.password)) {
				return callback('Incorrect password');
			}
			
			user.password = passwordHash.generate(_post.password_new);
			
			if(address != user.address) {
				needRecalculateBalance = true;
			}
			user.address = address.toLowerCase();
			
			user.save((err, user) => {
				if(err) return callback(`Updating user error`);
				
				req.session.passport.user = user;
				
				Controllers.authority.info(callback, data);
				if(needRecalculateBalance)
					Repositories.users.updateUserBalance(user);
			});
		});
	}
	
	enableTFA(callback, data) {
		let {_post, req} = data;
		let {email, password, tfa} = req.user;
		
		if(tfa) {
			return callback('Two factor authentication has already enabled');
		}
		
		if(!_post.password) {
			return callback('Password is required');
		}
		
		if(!_post.secret) {
			return callback('Secret phrase is required');
		}
		
		if(!passwordHash.verify(_post.password, password)) {
			return callback('Incorrect password');
		}
		
		Models.users.findOne({email}, (err, user) => {
			if(!user) return callback(`User with email ${email} is not exist`);
			
			user.tfa = true;
			user.secret = _post.secret;
			user.save((err, user) => {
				if(err) return callback(`Updating user error`);

                data.req.user = user;
                data.req.session.passport.user = user;
				
				Controllers.authority.info(callback, data, user);
			});
		});
		
	}
	
	disableTFA(callback, data) {
		let {_post, req} = data;
		let {email, password, tfa} = req.user;
		
		if(!tfa) {
			return callback('Two factor authentication has already disabled');
		}
		
		if(!_post.password) {
			return callback('Password is required');
		}
		
		if(!_post.token) {
			return callback('Token is required');
		}
		
		if(!passwordHash.verify(_post.password, password)) {
			return callback('Incorrect password');
		}
		
		Models.users.findOne({email}, (err, user) => {
			if(!user) return callback(`User with email ${email} is not exist`);
			
			let verification = twoFactor.verifyToken(user.secret, _post.token);

			if(!verification || !verification.hasOwnProperty('delta') || verification.delta != 0) {
				return callback('Incorrect token');
			}
			
			user.tfa = false;
			user.secret = null;
			user.save((err, user) => {
				if(err) return callback(`Updating user error`);

                data.req.user = user;
                data.req.session.passport.user = user;
				
				Controllers.authority.info(callback, data, user);
			});
		});
	}
}

Controllers.users = new UsersController();