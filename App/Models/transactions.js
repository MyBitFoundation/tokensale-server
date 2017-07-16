"use strict";

const mongoose = require('mongoose');

let Transactions = mongoose.model('transactions', new mongoose.Schema({
	userId: {
		ref: 'users',
		type: mongoose.Schema.Types.ObjectId,
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
}));

module.exports = Transactions;