"use strict";

let async = require('async'),
	passwordHash = require('password-hash'),
	logger = require('log4js').getLogger('Users Controller');

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
			Models.users.create({email, password}, err => {
				if(err) return GlobalError('103232432', err, cb);
				logger.info(`User ${email} created`);
				Controllers.authority.login(cb, data);
			});
		});
	}

	changePassword(cb, { _post, req }){
        if(!_post.password_old) {
            return cb('Old password is required');
        }

        if(!_post.password_new) {
            return cb('New password is required');
        }

        if(_post.password_retype != _post.password_new) {
            return cb('New password is not match retyped password');
        }

        let { email, password } = req.user;

        if(!passwordHash.verify(_post.password_old, password)){
        	return cb('Incorrect password');
		}


        Models.users.findOne({ email }, (err, user) => {
            if(!user) return cb(`User with email ${email} is not exist`);

            user.password = passwordHash.generate(_post.password_new);
            user.save((err, user)=>{
                if(err) return cb(`Updating user error`);

                cb(null, {});
            });
        });
	}
}

Controllers.users = new UsersController();