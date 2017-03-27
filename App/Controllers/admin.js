let async = require('async');

let Models = getModels(),
	Controllers = getControllers();

class AdminController {
	
	printPayers(cb) {
		Models.users.find({
			balance: {$gt: 0}
		}, (err, users) => {
			let result = [];
			async.each(users, (user, cb) => {
				Models.transactions.find({
					userId: user._id.toString()
				}, (err, txs) => {
					let sum = 0;
					txs.forEach(tx => {
						sum += tx.ethAmount;
					});
					result.push([user.email, user.balance, sum]);
					cb();
				});
			}, () => {
				cb(null, result);
			});
		});
	}
}

Controllers.admin = new AdminController();