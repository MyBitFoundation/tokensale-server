"use strict";

const mongoose = require('mongoose');

let History = mongoose.model('history', new mongoose.Schema({
	userId: {
		ref: 'users',
		type: mongoose.Schema.Types.ObjectId,
		index: true
	},
	address: {
		type: String,
		required: true,
		index: true
	},
	amount: {
		type: String,
		required: true
	},
	receivedTokens: {
		type: String,
		required: true
	},
	transactionHash:{
		type: String,
		required: true,
		index: {
			unique: true
		}
	},
	changellyInfo: {
		id: String,
		createdAt: Number,
		currencyFrom: String,
		currencyTo: String,
		payinAddress: String,
		payinExtraId: String,
		payinHash: String,
		payoutAddress: String,
		payoutExtraId: String,
		payoutHash: String,
		amountFrom: String,
		amountTo: String,
		networkFee: String
	}
}, {
	timestamps: true
}));

module.exports = History;