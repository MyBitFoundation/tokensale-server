let solc = require('solc');
let Web3 = require('web3');
let fs = require('fs');
let account = "0x71da8e59f6c9707b705dc96fd216a921bfe30a6a";
let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:9545"));
web3.personal.unlockAccount(account, '1');
//

let testContractSource = fs.readFileSync(__dirname + '/contracts/test.sol').toString().replace(/\s/g, ' ').replace(/\s{2,}/g, ' ');
let testCompiled = web3.eth.compile.solidity(testContractSource);
let testContract = web3.eth.contract(testCompiled['<stdin>:owned'].info.abiDefinition);

testContract.new({
	from: account,
	data: testCompiled['<stdin>:owned'].code,
	gas: 1000000
}, function(e, contract) {
	if(e) {
		return console.log(e);
	}
	if(!contract.address) {
		return console.log("Contract transaction send: TransactionHash: " + contract.transactionHash + " waiting to be mined...");
	}
	console.log(contract);

	let address = contract.address;
	// let address = '0xb2e72037c87c655509fd59ff8b2bd8571d767803';

	console.log('Mined', address);
	// web3.eth.call({from: account, to: address, data: "0xf2fde3"}, (err, result) => {
	// 	console.log(err, result);
	// });
	let test = web3.eth.contract(testCompiled['<stdin>:owned'].info.abiDefinition).at(address);
	test.transferOwnership("0xb2e72037c87c655509fd59ff8b2bd8571d767803", {
		from: account
	}, (err, result) => {
		console.log(err, result);
	});

	setInterval(() => {
		console.log(test.owner());
	}, 1000);
});
//
// return;
// setInterval(() => {
// 	let test = web3.eth.contract(testCompiled['<stdin>:owned'].info.abiDefinition).at(contract.address);
// 	console.log(test.owner());
// });

  - account
0x41ce4d1Cad0BEeC2054f8aFaD91fcDc04594C4c9 - token
