"use strict";

const mongoose = require('mongoose');

let exchangeTransactions = mongoose.model('exchange_transactions', new mongoose.Schema({
	orderId: {
		type: String,
		required: true
	},
	userId: {
		ref: 'users',
		type: mongoose.Schema.Types.ObjectId,
		index: true
	},
	depositAddress: {
		type: String,
		required: true
	},
	destinationAddress: {
		type: String,
		required: true
	},
	currency: {
		type: String,
		required: true
	},
	extraInfo: {
		type: String
	},
	isClosed: {
		type: Boolean,
		default: false
	},
	executedAt: {
		type: Date,
		default: null
	}
}, {
	timestamps: true
}));

module.exports = exchangeTransactions;