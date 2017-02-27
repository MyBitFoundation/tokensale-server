/**
 * Created by shumer on 2/24/17.
 */
"use strict";

let logger = require('log4js').getLogger('Settings Model');

let main = (Connect) => {
	let Schema = new Connect.Schema({
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
	});
	let model = Connect.model('settings', Schema);
	
	model.get = function(name, cb) {
		model.findOne({
			name: name
		}, function(err, Row) {
			if(err) {
				logger.error('settings.js 02.09.169:31', 'Error', err);
				return cb('Unknown error');
			}
			if(!Row) {
				return cb(null, null);
			}
			return cb(null, Row.value);
		});
	};
	
	model.set = function(name, value, cb = () => {}) {
		model.findOne({
			name: name
		}, (err, Row) => {
			if(err) {
				logger.error('settings.js 02.09.169:31', 'Error', err);
				return cb('Unknown error');
			}
			
			if(!Row) {
				model.create({
					name: name,
					value: value
				}, (err) => {
					if(err) {
						logger.error('settings.js 02.09.169:32', 'Error', err);
						return cb('Unknown error');
					}
					return cb();
				});
			} else {
				Row.value = value;
				Row.save(function(err) {
					if(err) {
						logger.error('settings.js 02.09.169:33', 'Error', err);
						return cb('Unknown error');
					}
					
					return cb();
				})
			}
		});
	};
	
	// only for tips in IDE
	let Models = {
		settings: model
	};
	return model;
};
module.exports = main;