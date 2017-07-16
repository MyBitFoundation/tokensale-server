"use strict";

const mongoose = require('mongoose');

let Settings = mongoose.model('settings', new mongoose.Schema({
	name: {
		type: String,
		required: true,
		default: false
	},
	value: {
		type: String,
		required: true,
		default: false
	}
}, {
	timestamps: true
}));

module.exports = Settings;