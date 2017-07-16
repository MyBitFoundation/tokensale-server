"use strict";

const mongoose = require('mongoose');

let DepositWallets = mongoose.model('deposit_wallets', new mongoose.Schema({
	userId: {
		type: String,
		required: true
	},
	orderId: {
		type: String,
		required: true
	},
	deposit: {
		type: String,
		index: true,
		required: true
	},
	depositType: {
		type: String,
		required: true
	},
	extraInfo: {
		type: String,
		default: false,
		required: false
	},
	transaction: {
		withdraw: String,
		incomingCoin: Number,
		incomingType: String,
		address: String,
		outgoingCoin: Number,
		outgoingType: String,
		transaction: String,
		fundAmount: Number,
		maxCommission: Number,
		tokenPrice: Number
	},
	executedAt: {
		type: Date,
		default: null
	}
}, {
	timestamps: true
}));

module.exports = DepositWallets;