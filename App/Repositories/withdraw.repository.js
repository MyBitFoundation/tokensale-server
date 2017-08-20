const logger = require('log4js').getLogger('App/Repositories/withdraw.repository'),
	raven = require('../Helpers/raven.helper');
const Models = {
	withdraw: require('../Models/withdraw')
};

class WithdrawRepository {
	
	static addNew(user, address, ip, cb) {
		let object = {
			userId: user._id,
			status: 'new',
			ethTransactionHash: '',
			tokenTransactionHash: '',
			amount: 0,
			ip: ip,
			fromAddress: user.generatedAddress,
			toAddress: address
		};
		logger.info('Add new request for withdraw');
		logger.info(object);
		Models.withdraw.create(object, (err) => {
			if(err) return raven.error(err, '1503221477964', cb);
			return cb();
		});
	}
	
	static findByStatus(status, cb) {
		Models.withdraw.find({status}, (err, List) => {
			if(err) return raven.error(err, '1503221999885', cb);
			return cb(null, List);
		});
	}
}

module.exports = WithdrawRepository;