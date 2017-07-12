let Repositories = {
	users: require('../Repositories/users.repository')
};

let Controllers = getControllers();

class ReferralsController {

	constructor() {}
	
	getUserReferrals(cb, data) {
		let user = data.req.user;
		Repositories.users.getReferrals(user._id, (err, List) => cb(err, List));
	}
}

Controllers.referrals = new ReferralsController();