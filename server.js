"use strict";

let async = require('async'),
	logger = require('log4js').getLogger("Main"),
	dir = require('node-dir'),
	fs = require('fs'),
	raven = require('./App/Helpers/raven.helper'),
	moment = require('moment');

let config = require('config');
// logger.info(config);
raven.initialize();

let Server = {
	models: {},
    contracts: {},
	controllers: {},
	init: function() {
		async.waterfall([
			this.runModels,
            this.runContracts,
			this.runControllers,
			this.bindDefault,
			this.run
		], function() {
			logger.info('Server running');
		});
	},
	runModels: function(cb) {
		Server.controllers['models'] = require(__dirname + '/App/Controllers/modelsWrapper')(function(err, models) {
			if(err) {
				return logger.error("Error in init models:", err);
			}
			Server.models = models;
			cb();
		});
	},
    runContracts: (cb) => {
        dir.files(__dirname + '/App/Contracts', function(err, files) {
            if(err) throw err;
            files.forEach(function(file) {
            	if(file.match(/abe\.json/))
            		return;
            	// console.log(file);
                // let name = file.replace(/.*\/([A-z]+)\.js/, '$1');
                // logger.info(name);
                let r = require(file);
                // if(typeof r == 'function') r(true);
            });
            cb();
        });
    },
	runControllers: (cb) => {
		dir.files(__dirname + '/App/Controllers', function(err, files) {
			if(err) throw err;
			files.forEach(function(file) {
				let name = file.replace(/.*\/([A-z]+)\.js/, '$1');
				if(name == 'modelsWrapper') {
					return;
				}
				logger.info(name);
				let r = require(file);
				if(typeof r == 'function') r(true);
			});
			cb();
		});
	},
	// use for actions before start applications
	bindDefault: (cb) => {
		cb();
	},
	run: function() {
		if(typeof config['app_api_host'] == 'undefined') {
			logger.error("Required parameter 'app_api_host' not specified in config/main.json file");
			return process.exit(1);
		}
		Server.controllers.api.init(config['app_api_host']);
		Server.controllers.users.init(()=>{
            Server.controllers.cron.init();
		});
	}
};

/**
 * @returns {{}}
 */
global.getModels = () => Server.models;

global.getContracts = () => Server.contracts;

global.getControllers = () => Server.controllers;

global.GlobalError = raven.GlobalError;
global.RootDir = __dirname;
global.sendWarning = raven.sendWarning;

Server.init();