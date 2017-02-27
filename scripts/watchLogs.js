let solc = require('solc');
let Web3 = require('web3');
let fs = require('fs');

let account = "0xc60b37a98f1a84f1bb8a0fbcffbed066986cbe56";

let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:9545"));

let crowdsaleContractSource = fs.readFileSync(__dirname + '/contracts/token.sol').toString().replace(/(?:\r\n|\r|\n)/g, ' ').replace(/\s{2,}/g, ' ');
let crowdsaleCompiled = web3.eth.compile.solidity(crowdsaleContractSource);
let crowdsaleContract = web3.eth.contract();
let crowdsaleAddress = '0x6dbd1489e04d49e68407dd872b76a04a83d78b71';
let crowdsale = web3.eth.contract(crowdsaleCompiled['<stdin>:MyToken'].info.abiDefinition).at(crowdsaleAddress);
//
// var filter = web3.eth.filter({fromBlock:1777, toBlock: 'latest', address: crowdsaleAddress, 'topics':[web3.sha3('pay(address)')]});
// filter.watch(function(error, result) {
//    console.log(result);
// })
//

filter = web3.eth.filter({fromBlock: 0, toBlock: 'latest', address: '0xc1600bd18265e7736ab605c8efc27de94f8fa1b8'})

filter.watch(function(error, result) {
   console.log(result);
});
