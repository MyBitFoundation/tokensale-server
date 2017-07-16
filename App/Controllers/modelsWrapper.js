"use strict";

let mongoose = require("mongoose"),
	dir = require('node-dir'),
	async = require("async"),
	config = require('config')['db'],
	logger = require('log4js').getLogger('App/Controllers/modelsWrapper');

let modelNameList = {};

let init = function(globalCb = () => {}) {
	async.waterfall([
		(cb) => {
			dir.files(__dirname + '/../Models', function(err, files) {
				if(err) throw err;
				files.forEach(function(file) {
					let name = file.replace(/.*\/([A-z]+)\.js/, '$1');
					if(name == 'modelsWrapper') {
						return;
					}
					modelNameList[name] = {};
				});
				cb();
			});
		},
		(cb) => {
			let userUrl = (config['user']) ? (config['user'] + ':' + config['password'] + '@') : '';
			let url = 'mongodb://' + userUrl + config['host'] + ':' + config['port'] + '/' + config['database'];
			mongoose.Promise = require('bluebird');
			API.connect = mongoose.connect(url, {useMongoClient: true}, function(err, db) {
				if(err)
					return cb(err);
				
				let Models = {};
				async.forEachOf(modelNameList, function(item, modelName, cb) {
					let m = require(__dirname + "/../Models/" + modelName + ".js");
					if(typeof m.find != 'function')
						Models[modelName] = m(API.connect);
					else
						Models[modelName] = m;
					cb();
				}, function(err) {
						API.connection = mongoose.connection;
					globalCb(err, Models, API.connect);
				});
			});
		}
	], globalCb);
};

let API = {
	connect: null,
	connection: null
};

module.exports = function(cb) {
	init(cb);
	return API;
};