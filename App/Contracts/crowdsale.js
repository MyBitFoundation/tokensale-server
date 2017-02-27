let async = require('async'),
	logger = require('log4js').getLogger(),
	config = require(ConfigPath),
	// contractSource = require(RootDir + '/scripts/contracts/crowdsale.sol').toString().replace(/\s/g, ' ').replace(/\s{2,}/g, ' '),
	abe = [ { "constant": false, "inputs": [], "name": "checkGoalReached", "outputs": [], "payable": false, "type": "function" }, { "constant": true, "inputs": [], "name": "deadline", "outputs": [ { "name": "", "type": "uint256", "value": "1492214399" } ], "payable": false, "type": "function" }, { "constant": true, "inputs": [], "name": "beneficiary", "outputs": [ { "name": "", "type": "address", "value": "0x28f201657b4dcbb5bd49c4f34155e8406d6408a4" } ], "payable": false, "type": "function" }, { "constant": true, "inputs": [], "name": "tokenReward", "outputs": [ { "name": "", "type": "address", "value": "0xc2ef79c129afb38c82a0efa7d34187ce14557fc0" } ], "payable": false, "type": "function" }, { "constant": true, "inputs": [ { "name": "", "type": "address" } ], "name": "balanceOf", "outputs": [ { "name": "", "type": "uint256", "value": "0" } ], "payable": false, "type": "function" }, { "constant": true, "inputs": [], "name": "fundingGoal", "outputs": [ { "name": "", "type": "uint256", "value": "8e+21" } ], "payable": false, "type": "function" }, { "constant": true, "inputs": [], "name": "amountRaised", "outputs": [ { "name": "", "type": "uint256", "value": "1000000000000000000" } ], "payable": false, "type": "function" }, { "constant": true, "inputs": [], "name": "tokenPrice", "outputs": [ { "name": "", "type": "uint256", "value": "4000000000000000" } ], "payable": false, "type": "function" }, { "constant": false, "inputs": [], "name": "safeWithdrawal", "outputs": [], "payable": false, "type": "function" }, { "inputs": [ { "name": "ifSuccessfulSendTo", "type": "address", "index": 0, "typeShort": "address", "bits": "", "displayName": "if Successful Send To", "template": "elements_input_address", "value": "" }, { "name": "fundingGoalInEthers", "type": "uint256", "index": 1, "typeShort": "uint", "bits": "256", "displayName": "funding Goal In Ethers", "template": "elements_input_uint", "value": "" }, { "name": "addressOfTokenUsedAsReward", "type": "address", "index": 2, "typeShort": "address", "bits": "", "displayName": "address Of Token Used As Reward", "template": "elements_input_address", "value": "" } ], "payable": false, "type": "constructor" }, { "payable": true, "type": "fallback" }, { "anonymous": false, "inputs": [ { "indexed": false, "name": "beneficiary", "type": "address" }, { "indexed": false, "name": "amountRaised", "type": "uint256" } ], "name": "GoalReached", "type": "event" }, { "anonymous": false, "inputs": [ { "indexed": false, "name": "backer", "type": "address" }, { "indexed": false, "name": "amount", "type": "uint256" }, { "indexed": false, "name": "isContribution", "type": "bool" } ], "name": "FundTransfer", "type": "event" } ];

let Contracts = getContracts();

class CrowdsaleContract {
	
	constructor() {
		this.contract = ethRPC.eth.contract(abe).at(config['ethereum']['crowdSaleContractAddress']);
		this.amountRaised = 0;
		
	}
	
	bindAmountRaised() {
		this.amountRaised = this.contract.amountRaised();
		setTimeout(() => this.bindAmountRaised(), 1000);
	}
}

Contracts.crowdsale = new CrowdsaleContract();