"use strict";

const moment = require('moment'),
	shortid = require('shortid'),
	mongoose = require('mongoose');

let Users = mongoose.model('users', new mongoose.Schema({
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
	contributeEthAmount: {
		type: Number,
		default: 0
	},
	presetBalance: {
		type: Number,
		default: 0,
		required: true
	},
	address: String,
	generatedAddress: String,
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
	},
	referralParams: {
		inviteCode: {type: String, unique: true, default: shortid.generate},
		referrer: {ref: 'users', type: mongoose.Schema.Types.ObjectId, index: true},
	}
}, {
	timestamps: true
}));

module.exports = Users;