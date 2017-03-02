"use strict";

let logger = require('log4js').getLogger('Users Model'),
	moment = require('moment');

let main = (Connect) => {
	let Schema = new Connect.Schema({
		userId: {
			type: String,
			required: true,
			index: true
		},
		amount: {
			type: Number,
			required: true
		},
		ethAmount: {
			type: Number,
			required: true
		},
		currency: {
			type: String,
			required: true
		},
		receivedTokens: {
			type: Number,
			required: true
		},
		txHash: {
			type: String,
			required: true,
			index: {
				unique: true
			}
		},
		crowdSaleTxHash: {
			type: String,
			required: true,
			index: {
				unique: true
			}
		},
		address: String,
		tokenPrice: Number
	}, {
		timestamps: true
	});
	let model = Connect.model('transactions', Schema);
	
	// only for tips in IDE
	let Models = {
		transactions: model
	};
	return model;
};
module.exports = main;