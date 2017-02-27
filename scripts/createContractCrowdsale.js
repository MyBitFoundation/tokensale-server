let solc = require('solc');
let Web3 = require('web3');
let fs = require('fs');
let account = "0x71da8e59f6c9707b705dc96fd216a921bfe30a6a";
//
let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:9545"));
web3.personal.unlockAccount(account, '1');
//
let crowdsaleContractSource = fs.readFileSync(__dirname + '/contracts/crowdsale.sol').toString().replace(/\s/g, ' ').replace(/\s{2,}/g, ' ');
let tokenContractSource = fs.readFileSync(__dirname + '/contracts/token.sol').toString().replace(/\s/g, ' ').replace(/\s{2,}/g, ' ');
let crowdsaleCompiled = web3.eth.compile.solidity(crowdsaleContractSource);
let tokenCompiled = web3.eth.compile.solidity(tokenContractSource);

let tokenContract = web3.eth.contract(tokenCompiled['<stdin>:MyToken'].info.abiDefinition);
let crowdsaleContract = web3.eth.contract(crowdsaleCompiled['<stdin>:Crowdsale'].info.abiDefinition);



let crowdsale = web3.eth.contract(crowdsaleCompiled['<stdin>:Crowdsale'].info.abiDefinition).at("0xf885268e1acad20360720a5855749e3a58df39c5");
console.log(web3.eth.sendTransaction({
	from: account,
	to: "0xf885268e1acad20360720a5855749e3a58df39c5",
	value: web3.toWei(1, 'ether')
}));

setTimeout(() => console.log(crowdsale.amountRaised()), 2000);
setTimeout(() => console.log(crowdsale.amountRaised()), 4000);
setTimeout(() => console.log(crowdsale.amountRaised()), 8000);
setTimeout(() => console.log(crowdsale.amountRaised()), 10000);
setTimeout(() => console.log(crowdsale.amountRaised()), 20000);
setTimeout(() => console.log(crowdsale.amountRaised()), 40000);
setTimeout(() => console.log(crowdsale.amountRaised()), 60000);

return;

let _token = tokenContract.new(0, "MBT", 4, "MBT", account, {
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
	
	let token = web3.eth.contract(tokenCompiled['<stdin>:MyToken'].info.abiDefinition).at(contract.address);
	console.log('!!!!!', contract.address);
	
	let crowdsale = crowdsaleContract.new(account, 1000, 200, contract.address, {
		from: account,
		data: crowdsaleCompiled['<stdin>:Crowdsale'].code,
		gas: 1000000
	}, function(e, contract) {
		if(!e) {
			if(!contract.address) {
				console.log("Contract transaction send: TransactionHash: " + contract.transactionHash + " waiting to be mined...");
			} else {
				
				
				setInterval(() => {
					console.log(token.owner());
				}, 1000);
				
				token.transferOwnership(contract.address, {
					from: account
				}, (err, result) => {
					console.log(err, result);
					
					setTimeout(() => {
						// console.log(contract);
						console.log("Contract mined! Address: " + contract.address);
						
						let crowdsale = web3.eth.contract(crowdsaleCompiled['<stdin>:Crowdsale'].info.abiDefinition).at(contract.address);
						console.log(web3.eth.sendTransaction({
							from: account,
							to: contract.address,
							value: web3.toWei(1, 'ether')
						}));
						
						setTimeout(() => console.log(crowdsale.amountRaised()), 2000);
						setTimeout(() => console.log(crowdsale.amountRaised()), 4000);
						setTimeout(() => console.log(crowdsale.amountRaised()), 8000);
						setTimeout(() => console.log(crowdsale.amountRaised()), 10000);
						setTimeout(() => console.log(crowdsale.amountRaised()), 20000);
						setTimeout(() => console.log(crowdsale.amountRaised()), 40000);
						setTimeout(() => console.log(crowdsale.amountRaised()), 60000);
					}, 10000);
				});
			}
			
		} else {
			console.log(e);
		}
	});
});

return;


// web3.eth.sendTransaction({from: web3.eth.accounts[0], to: '0xf09232a994add8722642288a22126a0ab07d9de1', value: web3.toWei(1, 'ether')})

web3.sha3('transferOwnership(address)').substr(0, 8)