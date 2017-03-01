"use strict";

let async = require('async'),
	logger = require('log4js').getLogger("Main"),
	dir = require('node-dir'),
	fs = require('fs'),
	Raven = require('raven'),
	moment = require('moment'),
	Web3 = require('web3');

global.ConfigPath = __dirname + '/config/main.json';

if(!fs.existsSync(ConfigPath)) {
	logger.error("Config file not found. Please create main.json file in config folder");
	process.exit(1);
}
let config = require(global.ConfigPath);

if(!fs.existsSync(__dirname + '/password')) {
	logger.error("File with password not found. Please create password file in root folder");
	process.exit(1);
}
global.password = fs.readFileSync(__dirname + '/password');
logger.error("!!!! Don't forget remove file with password !!!!");

if(!config['disableRaven']) {
	Raven.config('https://c49da81fc9914402ab681dbf9b4684bc:f401db00f9064d0eb37e8a076294104e@sentry.pixelplex.by/2').install((e, d) => {
		logger.error(d);
		process.exit(1);
	});
}
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

global.GlobalError = (key, err, cb = () => {}) => {
	logger.error(key, err);
	cb('Unknown error');
	if(Raven && !config['disableRaven']) {
		if (!(err instanceof Error)) {
			err = new Error(err);
		}
		err.key = key;
		Raven.captureException(err, {
			key: key
		});
	}
};
global.RootDir = __dirname;

let web3 = new Web3(new Web3.providers.HttpProvider(config['ethereum']['rpc']));

web3._extend({
    property: 'personal',
    methods: [new web3._extend.Method({
        name: 'importRawKey',
        call: 'personal_importRawKey',
        params: 2
    })],
    properties: []
});

global.ethRPC = web3;

Server.init();