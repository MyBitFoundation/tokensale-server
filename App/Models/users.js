"use strict";

let logger = require('log4js').getLogger('Users Model'),
	moment = require('moment');

let main = (Connect) => {
	let Schema = new Connect.Schema({
		email: {
			type: String,
			required: true,
			index: {unique: true}
		},
		password: {
			type: String,
			required: true
		},
		disabled: {
			type: Boolean,
			default: false
		},
		lastLoginDate: {
			type: Date,
			default: null
		}
	}, {
		timestamps: true
	});
	let model = Connect.model('users', Schema);
	
	// only for tips in IDE
	let Models = {
		users: model
	};
	return model;
};
module.exports = main;