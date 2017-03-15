"use strict";

let async = require('async'),
	logger = require('log4js').getLogger(),
	moment = require('moment'),
	express = require('express'),
	mongoose = require('mongoose'),
	extend = require('extend'),
	passport = require('passport'),
	bodyParser = require('body-parser'),
	session = require('express-session'),
	crypto = require('crypto'),
	MongoStore = require('connect-mongo')(session),
	cors = require('cors'),
	multer = require('multer'),
	fs = require('fs');

let Controllers = getControllers();
let Contracts = getContracts();
let Models = getModels();

let APIController = {
	////////////////////////////////////////////////////////////////////////////////////////////////
	initRoutes: () => {
		APIController.addHandler('post', '/users/registration', Controllers.users.registration, true);
		APIController.addHandler('post', '/users/login', Controllers.authority.login, true);
		APIController.addHandler('get', '/users/logout', Controllers.authority.logout);
		APIController.addHandler('get', '/users/me', Controllers.authority.me);
        APIController.addHandler('post', '/users/change-password', Controllers.users.changePassword);
        APIController.addHandler('post', '/users/enable-tfa', Controllers.users.enableTFA);
        APIController.addHandler('post', '/users/disable-tfa', Controllers.users.disableTFA);

        APIController.addHandler('post', '/crowdsale/deposit', Controllers.crowdsale.deposit);
        APIController.addHandler('get', '/crowdsale/transactions', Controllers.crowdsale.transactions);
        APIController.addHandler('get', '/crowdsale/rates', Controllers.crowdsale.rates, true);
        APIController.addHandler('get', '/crowdsale/exchange-amount', Controllers.crowdsale.exchangeAmount, true);
	},
	////////////////////////////////////////////////////////////////////////////////////////////////
	app: {},
	io: null,
	sessionStore: null,
	init: (port) => {
		APIController.sessionStore = new MongoStore({mongooseConnection: Controllers.models.connection});
		APIController.runServer(port);
		
		let corsOptions = {
			origin: (origin, callback) => {
				callback(null, true);
			},
			credentials: true,
			methods: ['GET', 'PUT', 'POST', 'OPTIONS', 'DELETE', 'PATCH'],
			headers: ['x-user', 'X-Signature', 'accept', 'content-type']
		};
		APIController.app.use(cors(corsOptions));
		APIController.app.use(bodyParser.urlencoded({extended: true}));
		APIController.app.use(bodyParser.json());
		APIController.app.options('*', cors());
		APIController.app.use(session({
			resave: true,
			saveUninitialized: true,
			secret: '459ao8kslfg40eef3898aloemxdf32b31a6',
			store: APIController.sessionStore
		}));
		APIController.app.use(passport['initialize']());
		APIController.app.use(passport['session']());
		
		APIController.initRoutes();
	},
	server: null,
	getServer: () => APIController.server,
	runServer: port => {
		let express = require('express');
		APIController.app = express();
		APIController.app.use(express.static(RootDir + '/public'));
		
		APIController.server = require('http').Server(APIController.app);
		APIController.server.listen(port, '0.0.0.0');
		logger.info('API APP REST listen ' + port + ' Port');
	},
	/**
	 * Register new route.
	 */
	addHandler: (type, route, action, isPublic) => {
		if(typeof action != 'function') {
			logger.warn(`Action for route ${type}:${route} is not function`);
		}
		
		APIController.app[type](route, (req, res) => {
			let time = parseInt(moment().format('X'));
			logger.info('Start request', route);
			async.waterfall([
				cb => {
					if(isPublic) return cb();
					if(!req.isAuthenticated()) return cb('User not logged', 403);

                    Models.users.findOne({ email : req.user.email }, (err, user) => {
                        if(err) {
                            return cb(err);
                        }
                        if(!user) {
                            return cb('User not logged', 403);
                        }

                        if(req.user.password != user.password || req.user.tfa != user.tfa){
                            req.logout();
                        	req.session.destroy();
                            return cb('User not logged', 403);
						}

                        return cb();
					});
				},
				// run method
				cb => {
					action(cb, {
						_post: req.body,
						_get: extend({}, req.query, req.params),
						req: req,
						res: res,
						user: req.user
					});
				}
			], (err, result) => {
				res.header('Content-Type', 'text/json');
				res.header('Content-Security-Policy','default-src *; frame-src *');
				if(err) {
					if(typeof err == 'string') {
						err = {
							message: err
						};
					}
					return res.status((result && !isNaN(parseInt(result))) ? result : 400).end(JSON.stringify(err));
				}
				if(typeof result != 'object') {
					result = {
						result: result
					};
				}
				logger.info('End request', route, parseInt(moment().format('X')) - time);
				return res.send(result);
			});
			APIController.logRouter(type, route);
		});
	},
	logRouter: (type, route) => {
		return logger.info(`[REQUEST] ${type.toUpperCase()}: '${route}'`);
	}
};
Controllers.api = APIController;