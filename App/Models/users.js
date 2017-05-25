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
		tfa: {
			type: Boolean,
			required: false,
			default: false
		},
		secret: {
			type: String,
			required: false,
			default: null
		},
		balance: {
			type: Number,
			default: 0,
			required: true
		},
		presetBalance: {
			type: Number,
			default: 0,
			required: true
		},
		privateKey: {
			type: String,
			required: true
		},
		publicKey: {
			type: String,
			required: true
		},
		address: {
			type: String,
			required: true
		},
		preSaleAddress: {
			type: String
		},
		disabled: {
			type: Boolean,
			default: false
		},
		lastLoginDate: {
			type: Date,
			default: null
		},
		role: {
			type: String,
			enum: ['user', 'admin'],
			default: "user"
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