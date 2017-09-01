'use strict';

let ethereum = require('../App/Helpers/ethereum.helper');

exports.up = function(next) {
	ethereum.unlock('0x7bdb793e1ff2559d29e11f7d64d2d9e4676e440e', (err) => {
		if(err) return next(err);
		let hash = ethereum.web3.eth.sendTransaction({from: "0x7bdb793e1ff2559d29e11f7d64d2d9e4676e440e", to: "0xB3d1bC3eFA1b5A976EEA245e339a9ECB55C90626", value: 342409820400000000});
		console.log(hash);
		next();
	});
};

exports.down = function(next) {
	next();
};
