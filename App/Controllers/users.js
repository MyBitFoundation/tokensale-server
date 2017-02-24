"use strict";

let async = require('async'),
	passwordHash = require('password-hash'),
	logger = require('log4js').getLogger('Users Controller'),
    twoFactor = require('node-2fa'),
    ethHelper = require('../Components/eth');

let Controllers = getControllers(),
	Models = getModels();

class UsersController {
	
	constructor() {
		logger.info('Users controller initialized');
	}
	
	registration(cb, data) {
		let post = data._post;
		if(!post.email) {
			return cb('Email is required');
		}
		if(!post.email.match(/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/)) {
			return cb('Invalid email');
		}
		if(!post.password || post.password.length < 6) {
			return cb('Password is required and must contain at least 6 characters');
		}
		
		let {email, password} = post;
		password = passwordHash.generate(password);
		email = email.toLowerCase();
		Models.users.findOne({email}, (err, exist) => {
			if(exist) return cb(`User with email ${email} already exist`);

            ethHelper.generateBrainKey(password, email, (privateKey)=>{
                if(!privateKey){
                    return cb('User creation error');
                }

                let encryptedPrivateKey = ethHelper.encryptWithPassword(privateKey, password),
                    publicKey = ethHelper.publicFromPrivate(privateKey);

                if(!publicKey){
                    return cb('User creation error');
                }

                Models.users.create({email, password, privateKey : encryptedPrivateKey, publicKey}, err => {
                    if(err) return GlobalError('103232432', err, cb);
                    logger.info(`User ${email} created`);
                    Controllers.authority.login(cb, data);
                });
            });


		});
	}

	changePassword(callback, data){
        let { _post, req } = data;

        if(!_post.password_old) {
            return callback('Old password is required');
        }

        if(!_post.password_new) {
            return callback('New password is required');
        }

        if(_post.password_retype != _post.password_new) {
            return callback('New password does not match retyped password');
        }

        let { email, password } = req.user;

        if(!passwordHash.verify(_post.password_old, password)){
        	return callback('Incorrect password');
		}

        Models.users.findOne({ email }, (err, user) => {
            if(!user) return callback(`User with email ${email} is not exist`);

            user.password = passwordHash.generate(_post.password_new);
            user.save((err, user)=>{
                if(err) return callback(`Updating user error`);

                req.session.passport.user = user;

                Controllers.authority.me(callback, data);
            });
        });
	}

	enableTFA(callback, data){
		let { _post, req } = data;
        let { email, password, tfa } = req.user;

        if(tfa){
            return callback('Two factor authentication has already enabled');
        }

        if(!_post.password){
            return callback('Password is required');
        }

		if(!_post.secret){
            return callback('Secret phrase is required');
		}

		if(!passwordHash.verify(_post.password, password)){
            return callback('Incorrect password');
		}

        Models.users.findOne({ email }, (err, user) => {
            if(!user) return callback(`User with email ${email} is not exist`);

            user.tfa = true;
            user.secret = _post.secret;
            user.save((err, user)=>{
                if(err) return callback(`Updating user error`);

                req.session.passport.user = user;

                Controllers.authority.me(callback, data);
            });
        });

	}

	disableTFA(callback, data){
        let { _post, req } = data;
        let { email, password, tfa } = req.user;

        if(!tfa){
            return callback('Two factor authentication has already disabled');
		}

        if(!_post.password){
            return callback('Password is required');
        }

        if(!_post.token){
            return callback('Token is required');
        }

        if(!passwordHash.verify(_post.password, password)){
            return callback('Incorrect password');
        }

        Models.users.findOne({ email }, (err, user) => {
            if(!user) return callback(`User with email ${email} is not exist`);

            let verification = twoFactor.verifyToken(user.secret, _post.token);

            if(!verification || !verification.hasOwnProperty('delta') || verification.delta != 0){
                return callback('Incorrect token');
			}

            user.tfa = false;
            user.secret = null;
            user.save((err, user)=>{
                if(err) return callback(`Updating user error`);

                req.session.passport.user = user;

                Controllers.authority.me(callback, data);
            });
        });
	}
}

Controllers.users = new UsersController();