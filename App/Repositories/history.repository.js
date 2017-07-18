const raven = require('../Helpers/raven.helper'),
    BigNumber = require('bignumber.js'),
	logger = require('log4js').getLogger('App/Repositories/history.repository');
let Models = {
	history: require('../Models/history')
};
let Contracts = {
	crowdsale: require('../Contracts/crowdsale')
};

class HistoryRepository {

	static findByChangellyId(id, cb) {
		Models.history.findOne({
			'changellyInfo.id': id
		}, (err, Row) => {
			if(err) return raven.error(err, '1500206719794', cb);
			return cb(null, Row);
		});
	}
	
	static newLog(userId, address, amount, transactionHash, changellyInfo, cb) {
		Models.history.findOne({transactionHash}, (err, Row) => {
			if(err) return raven.error(err, '1500207489329', cb);
			if(!Row) return this.addNew(userId, address, amount, transactionHash, changellyInfo, cb);
			
			if(userId)
				Row.userId = userId;
			if(changellyInfo)
				Row.changellyInfo = changellyInfo;
			Row.save(err => {
				if(err) return raven.error(err, '1500207549372', cb);
				return cb();
			})
		});
	}
	
	static addNew(userId, address, amount, txHash, changellyInfo, cb) {
		amount = new BigNumber(amount);
		Models.history.create({
			userId: userId,
			amount: new BigNumber(amount).toNumber(),
			address: address,
			receivedTokens: amount.div(Contracts.crowdsale.currentPrice).toNumber(),
			transactionHash: txHash,
			changellyInfo: changellyInfo
		}, (err) => {
			if(err) return raven.error(err, '1500207431257', cb);
			
			return cb();
		});
	}
	
	static getByAddresses(addresses, cb) {
		logger.info(addresses);
		Models.history.find({
			address: {
				$in: addresses
			}
		}, (err, List) => {
			if(err) return raven.error(err, '1500212453302', cb);
			return cb(null, List);
		});
	}
	
	static getForInfo(cb) {
		Models.history.aggregate([{
				$group: {
					_id: "$coin",
					amount: {$sum: "$amount"},
					tokens: {$sum: "$receivedTokens"},
					count: {$addToSet: "$address"}
				}
			}, {
				$project: {_id: 1, amount: 1, tokens: 1, countInvestors: {$size: "$count"}}
			}]
		).exec((err, Info) => {
			if(err) return raven.error(err, '1499959996923', cb);
			cb(null, Info);
		});
	}
}

module.exports = HistoryRepository;