let solc = require('solc');
let Web3 = require('web3');
let fs = require('fs');

let account = "0x71da8e59f6c9707b705dc96fd216a921bfe30a6a";
let crowdsaleAddress = '0x55070c600701ac80b3d2105bcd8c1e25951d5510';
let tokenAddress = '0xc4506b99c706303e00bbbf7032b668fd24174517';

let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:9545"));

let crowdsaleContractSource = fs.readFileSync(__dirname + '/contracts/crowdsale.sol').toString().replace(/(?:\r\n|\r|\n)/g, ' ').replace(/\s{2,}/g, ' ');
let tokenContractSource = fs.readFileSync(__dirname + '/contracts/token.sol').toString().replace(/(?:\r\n|\r|\n)/g, ' ').replace(/\s{2,}/g, ' ');

let crowdsaleCompiled = web3.eth.compile.solidity(crowdsaleContractSource);
let crowdsaleContract = web3.eth.contract();
let crowdsale = web3.eth.contract(crowdsaleCompiled['<stdin>:Crowdsale'].info.abiDefinition).at(crowdsaleAddress);

let tokenCompiled = web3.eth.compile.solidity(tokenContractSource);
let tokenContract = web3.eth.contract();
let token = web3.eth.contract(tokenCompiled['<stdin>:MyToken'].info.abiDefinition).at(tokenAddress);

// console.log(parseFloat(crowdsale.balanceOf(account)));
// console.log(parseFloat(crowdsale.totalSupply()));

// var crowdsale = tokenContract.new("0x71da8e59f6c9707b705dc96fd216a921bfe30a6a", 100, 20, '0xc4506b99c706303e00bbbf7032b668fd24174517', {from:web3.eth.accounts[0], data: crowdsaleCompiled['<stdin>:Crowdsale'].code, gas: 1000000}, function(e, contract){
//   if(!e) {
//     if(!contract.address) {
//       	console.log("Contract transaction send: TransactionHash: " + contract.transactionHash + " waiting to be mined...");
//     } else {
//       	console.log(contract);
//         console.log("Contract mined! Address: " + contract.address);
//     }
//
// 	} else {
// 		console.log(e);
// 	}
// })
// return;



// web3.eth.sendTransaction({from:  web3.eth.accounts[0], to: account, value: web3.toWei(100, 'ether')})
console.log(web3.eth.sendTransaction({from: account, to: crowdsaleAddress, value: web3.toWei(1, 'ether')}));

setTimeout(() => console.log(crowdsale.amountRaised()), 2000);
setTimeout(() => console.log(crowdsale.amountRaised()), 4000);
setTimeout(() => console.log(crowdsale.amountRaised()), 6000);