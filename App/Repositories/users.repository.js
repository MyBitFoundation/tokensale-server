const raven = require('../Helpers/raven.helper'),
	shortid = require('shortid'),
	passwordHash = require('password-hash'),
	async = require('async'),
	BigNumber = require('bignumber.js'),
	logger = require('log4js').getLogger('App/Repositories/users.repository');

let Models = {
	users: require('../Models/users')
};

let Helpers = {
	ethereum: require('../Helpers/ethereum.helper')
};
let Contracts = {
	token: require('../Contracts/token'),
	crowdsale: require('../Contracts/crowdsale')
};

class UsersRepository {
	
	static findByEmail(email, cb) {
		Models.users.findOne({email}, (err, result) => {
			if(err) return raven.error(err, '1499867999033', cb);
			return cb(null, result);
		});
	}
	
	static findAll(cb) {
		Models.users.find({}, (err, list) => {
			if(err) return raven.error(err, '1501094926402', cb);
			return cb(null, list);
		});
	}
	
	static findOne(query, cb) {
		Models.users.findOne(query, (err, result) => {
			if(err) return raven.error(err, '1499867999023', cb);
			return cb(null, result);
		});
	}
	
	static create(email, password, address, referrerId, cb) {
		password = passwordHash.generate(password);
		Models.users.create({
			email: email.toLowerCase(),
			password: password,
			address: address || "",
			generatedAddress: Helpers.ethereum.generateNewAddress(),
			referralParams: {
				referrer: referrerId,
				inviteCode: shortid.generate()
			}
		}, (err, User) => {
			if(err) return raven.error(err, '1499868670748', cb);
			return cb(null, User);
		});
	}
	
	static getReferrals(userId, cb) {
		Models.users.find({
			'referralParams.referrer': userId
		}, "email contributeEthAmount address", (err, List) => {
			if(err) return raven.error(err, '1499869931753', cb);
			return cb(null, List);
		});
	}
	
	static updateBalance(address, cb = () => {}) {
		Models.users.find({
			$or: [{
				generatedAddress: address
			}, {
				address: address
			}]
		}, (err, Users) => {
			if(err) return raven.error(err, '1500210293026', cb);
			if(!Users.length) return cb();
			
			async.eachSeries(Users, (User, next) => {
				UsersRepository.updateUserBalance(User, next);
			}, err => cb(err));
		});
	}
	
	static updateUserBalance(User, cb = () => {}) {
		let balance = new BigNumber(0);
		let contributeEthAmount = new BigNumber(0);
		if(User.address && User.address != '-') {
			balance = balance.plus(Contracts.token.getBalance(User.address));
			contributeEthAmount = contributeEthAmount.plus(Contracts.crowdsale.getBalance(User.address));
		}
		balance = balance.plus(Contracts.token.getBalance(User.generatedAddress));
		contributeEthAmount = contributeEthAmount.plus(Contracts.crowdsale.getBalance(User.generatedAddress));
		
		logger.info(`Recalculate balance for user ${User.email}. Old - ${User.balance}, new - ${balance.toString()}`);
		logger.info(`Recalculate contributeEthAmount for user ${User.email}. Old - ${User.contributeEthAmount}, new - ${contributeEthAmount.toString()}`);
		User.balance = balance.toNumber();
		User.contributeEthAmount = contributeEthAmount.toNumber();
		User.save(err => {
			if(err) return raven.error(err, '1500211309516', cb);
			return cb();
		});
	}
}

module.exports = UsersRepository;