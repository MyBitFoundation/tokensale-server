let solc = require('solc');
let Web3 = require('web3');
let fs = require('fs');
let account = "0x2672dc074d67cee2d3b7508d78661f6d0c277965";

let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:9545"));
web3.personal.unlockAccount(account, '1');
let tokenContractSource = fs.readFileSync(__dirname + '/contracts/token.sol').toString().replace(/\s/g, ' ').replace(/\s{2,}/g, ' ');
let tokenCompiled = web3.eth.compile.solidity(tokenContractSource);
let tokenContract = web3.eth.contract(tokenCompiled['<stdin>:MyToken'].info.abiDefinition);
//
tokenContract.new(0, "MBT", 4, "MBT", account, {
	from: account,
	data: tokenCompiled['<stdin>:MyToken'].code,
	gas: 1000000
}, function(e, contract) {
	if(e) {
		return console.log(e);
	}
	if(!contract.address) {
		return console.log("Contract transaction send: TransactionHash: " + contract.transactionHash + " waiting to be mined...");
	}

	console.log('Mined', contract.address);

	// let tokenAddress = '0x07e3ba31f681133dab662ff9352250c0d589c195';
	let tokenAddress = contract.address;
	let token = web3.eth.contract(tokenCompiled['<stdin>:MyToken'].info.abiDefinition).at(tokenAddress);
	setInterval(() => console.log(token.totalSupply()), 1000);

	token.mintToken(account, 100, {
		from: account
	}, (err, result) => {
		console.log(err, result);
	});
});
//
//
// let tokenAddress = '0x07e3ba31f681133dab662ff9352250c0d589c195';
// let token = web3.eth.contract(tokenCompiled['<stdin>:MyToken'].info.abiDefinition).at(tokenAddress);
// setInterval(() => console.log(token.totalSupply()), 1000);
//
// token.mintToken(account, 100, {
// 	from: account
// }, (err, result) => {
// 	console.log(err, result);
// });
