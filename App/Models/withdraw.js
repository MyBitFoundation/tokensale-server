"use strict";

const mongoose = require('mongoose');

let Withdraw = mongoose.model('withdraw', new mongoose.Schema({
	userId: {
		ref: 'users',
		type: mongoose.Schema.Types.ObjectId,
		index: true
	},
	status: {
		type: String,
		enum: ['new', 'wait_eth', 'processed', 'completed', 'error']
	},
	ethTransactionHash: String,
	tokenTransactionHash: String,
	ip: String,
	amount: Number,
	gasPrice: Number,
	gasLimit: Number,
	fromAddress: String,
	toAddress: String
}, {
	timestamps: true
}));

module.exports = Withdraw;