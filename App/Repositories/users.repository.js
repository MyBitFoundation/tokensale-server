const raven = require('../Helpers/raven.helper'),
	shortid = require('shortid'),
	passwordHash = require('password-hash'),
	BigNumber = require('bignumber.js'),
	logger = require('log4js').getLogger('App/Repositories/users.repository');

let Models = {
	users: require('../Models/users')
};

let Helpers = {
	ethereum: require('../Helpers/ethereum.helper')
};
let Contracts = {
	token: require('../Contracts/token')
};

class UsersRepository {
	
	static findByEmail(email, cb) {
		Models.users.findOne({email}, (err, result) => {
			if(err) return raven.error(err, '1499867999033', cb);
			return cb(null, result);
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
			email, password,
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
		Models.users.findOne({
			$or: [{
				generatedAddress: address
			}, {
				address: address
			}]
		}, (err, User) => {
			if(err) return raven.error(err, '1500210293026', cb);
			if(!User) return cb();
			
			let balance = new BigNumber(0);
			if(User.address)
				balance = balance.plus(Contracts.token.getBalance(User.address));
			balance = balance.plus(Contracts.token.getBalance(User.generatedAddress));
			logger.info(`Recalculate balance for user ${User.email}. Old - ${User.balance}, new - ${balance.toString()}`);
			User.balance = balance.toNumber();
			User.save(err => {
				if(err) return raven.error(err, '1500211309516', cb);
				return cb();
			});
		});
	}
}

module.exports = UsersRepository;