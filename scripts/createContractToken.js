let solc = require('solc');
let Web3 = require('web3');
let fs = require('fs');

let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:9545"));

let tokenContractSource = fs.readFileSync(__dirname + '/contracts/token.sol').toString().replace(/(?:\r\n|\r|\n)/g, ' ').replace(/\s{2,}/g, ' ');
var tokenCompiled = web3.eth.compile.solidity(tokenContractSource);
var tokemContract = web3.eth.contract(tokenCompiled['<stdin>:MyToken'].info.abiDefinition);
var token = tokemContract.new(0, 'MyBitTest', '0x3', 'MBT', web3.eth.accounts[0], {from:web3.eth.accounts[0], data: tokenCompiled['<stdin>:MyToken'].code, gas: 1000000}, function(e, contract){
  if(!e) {
    if(!contract.address) {
      	console.log("Contract transaction send: TransactionHash: " + contract.transactionHash + " waiting to be mined...");
    } else {
      	console.log(contract);
        console.log("Contract mined! Address: " + contract.address);
    }

	} else {
		console.log(e);
	}
})
return;




//vch.sendTransaction({from: '0xc59d6ada44edacc2192023090d6c79926f35c148', to: '0x0c4ad4703dcdedad9ee9ef35306764d2ddba3bd1', value: web3.toWei(1, 'vechain')})
