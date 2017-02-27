let solc = require('solc');
let Web3 = require('web3');
let fs = require('fs');
let account = "0x2672dc074d67cee2d3b7508d78661f6d0c277965";

let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:9545"));
// web3.personal.unlockAccount(account, '1');

let crowdSaleContractSource = fs.readFileSync(__dirname + '/contracts/crowdsale.sol').toString().replace(/\s/g, ' ').replace(/\s{2,}/g, ' ');
console.log(crowdSaleContractSource);
let crowdSaleCompiled = web3.eth.compile.solidity(crowdSaleContractSource);
// 	crowdSaleContract = web3.eth.contract(crowdSaleCompiled['<stdin>:Crowdsale'].info.abiDefinition);
// console.log(crowdSaleCompiled['<stdin>:Crowdsale'].info.abiDefinition);
return;
// let tokenContractSource = fs.readFileSync(__dirname + '/contracts/token.sol').toString().replace(/\s/g, ' ').replace(/\s{2,}/g, ' '),
// 	tokenCompiled = web3.eth.compile.solidity(tokenContractSource),
// 	tokenAddress = '0x24f674229671b26ee97c62b31ea01537eacb7df2',
// 	token = web3.eth.contract(tokenCompiled['<stdin>:MyToken'].info.abiDefinition).at(tokenAddress);
// let crowdsale = web3.eth.contract(tokenCompiled['<stdin>:MyToken'].info.abiDefinition).at(tokenAddress);
// 	console.log(tokenCompiled['<stdin>:MyToken'].info.abiDefinition);
// 	return;

crowdSaleContract.new(account, 1000, 200, tokenAddress, {
	from: account,
	data: crowdSaleCompiled['<stdin>:Crowdsale'].code,
	gas: 1000000
}, function(e, contract) {
	if(e) {
		return console.log(e);
	}
	if(!contract.address) {
		return console.log("Contract transaction send: TransactionHash: " + contract.transactionHash + " waiting to be mined...");
	}

	console.log('Mined crowdSale', contract.address);

	let checkOwner = () => {
		let owner = token.owner();
		console.log('Owner', owner);
		if(owner != contract.address) {
			return setTimeout(() => checkOwner(), 1000);
		}

		let croudsale = web3.eth.contract(crowdSaleCompiled['<stdin>:Crowdsale'].info.abiDefinition).at(contract.address);
		setInterval(() => console.log(croudsale.balanceOf(account)), 1000);

		web3.eth.sendTransaction({
			from: account,
			to: contract.address,
			value: web3.toWei(1, 'ether')
		}, (err, result) => {
			console.log(err, result);
		});
	};

	checkOwner();

	token.transferOwnership(contract.address, {
		from: account
	}, (err, result) => {
		console.log(err, result);
	});
});
