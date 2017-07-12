const raven = require('../Helpers/raven.helper'),
	shortid = require('shortid'),
	passwordHash = require('password-hash');

let Models = {
	users: require('../Models/users')
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
}

module.exports = UsersRepository;