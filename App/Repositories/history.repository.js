const raven = require('../Helpers/raven.helper'),
    BigNumber = require('bignumber.js');
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
			amount: amount,
			address: address,
			receivedTokens: amount.div(Contracts.crowdsale.currentPrice),
			transactionHash: txHash,
			changellyInfo: changellyInfo
		}, (err) => {
			if(err) return raven.error(err, '1500207431257', cb);
			
			return cb();
		});
	}
}

module.exports = HistoryRepository;