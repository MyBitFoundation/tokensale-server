"use strict";

let async = require('async'),
	passwordHash = require('password-hash'),
	logger = require('log4js').getLogger('Users Controller'),
    twoFactor = require('node-2fa'),
    config = require(ConfigPath),
    ethHelper = require('../Components/eth');

let Controllers = getControllers(),
	Models = getModels();

class UsersController {

	constructor() {
        this.users = {};
		logger.info('Users controller initialized');
	}

	init(callback){
        Models.users.find({
            tfa : false
        }, (err, users)=>{
            users.forEach((user)=>{
                if(user.address){
                    Controllers.users.users[user.address] = user._id;
                }

            });

            callback()
        });
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

		let passwordString = passwordHash.generate(password);

		email = email.toLowerCase();
		Models.users.findOne({email}, (err, exist) => {
			if(exist) return cb(`User with email ${email} already exist`);

            ethHelper.generateBrainKey(passwordString, email, (privateKey)=>{
                if(!privateKey){
                    return cb('User creation error');
                }

                let encryptedPrivateKey = ethHelper.encryptWithPassword(privateKey, password),
                    publicKey = ethHelper.publicFromPrivate(privateKey),
                    address = ethHelper.addressFromPrivate(privateKey);

                if(!publicKey){
                    return cb('User creation error');
                }

                //TODO only for tests. Password set in terminal
                if(config['ethereum']['rpc_enabled']){
                    let resultAddress = ethRPC.personal.importRawKey(privateKey.slice(2), ethPassword);

                    if(!resultAddress || (resultAddress != address)){
                        return cb('Unlocking user wallet error');
                    }
                }

                Models.users.create({email, password : passwordString, privateKey : encryptedPrivateKey, publicKey, address}, (err, user) => {
                    Controllers.users.users[user.address] = user._id;

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

        Models.users.findOne({ email }, (err, user) => {
            if(!user) return callback(`User with email ${email} is not exist`);

            if(!passwordHash.verify(_post.password_old, user.password)){
                return callback('Incorrect password');
            }

            let privateKey  = ethHelper.decryptWithPassword(user.privateKey, _post.password_old),
                address     = ethHelper.addressFromPrivate(privateKey);

            if(!address || user.address != address){
                return callback("Private key decryption password error")
            }

            user.password   = passwordHash.generate(_post.password_new);
            user.privateKey = ethHelper.encryptWithPassword(privateKey, _post.password_new);

            user.save((err, user)=>{
                if(err) return callback(`Updating user error`);

                req.session.passport.user = user;

                Controllers.authority.info(callback, data);
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

                Controllers.authority.info(callback, data);
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

                Controllers.authority.info(callback, data);
            });
        });
	}
}

Controllers.users = new UsersController();