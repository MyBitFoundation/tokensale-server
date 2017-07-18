const form = require('express-form');

let Repositories = {
	users: require('../Repositories/users.repository')
};

module.exports = {
	
	registration: form(
		form.validate('email').trim().toLowerCase().isEmail('Not a valid email address').required('Email is required.')
			.custom((email, source, cb) => {
				Repositories.users.findByEmail(email.toLowerCase(), (err, result) => {
					if(err) cb(new Error(err));
					if(result) return cb(new Error('This email is already in use.'));
					cb(null);
				});
			}),
		form.validate('password').required('Password is required.').minLength(6),
		form.validate('referrer_key').trim(),
		form.validate('address').trim().is(/^(0x)?[0-9a-fA-F]{40}$/, 'Invalid address')
	)
};