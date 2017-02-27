pragma solidity ^0.4.2;
contract token {
   uint8 public decimals;
   uint256 public totalSupply;
   function mintToken(address receiver, uint amount){  }
}
contract Crowdsale {
   address public beneficiary;
   uint public fundingGoal;
   uint public amountRaised;
   // 14.04.2017 23:59:59
   uint public deadline = 1492214399;
   uint public tokenPrice;
   uint price;
   token public tokenReward;
   mapping(address => uint256) public balanceOf;
   bool fundingGoalReached = false;
   event GoalReached(address beneficiary, uint amountRaised);
   event FundTransfer(address backer, uint amount, bool isContribution);
   bool crowdsaleClosed = false;
   uint tokenMultiplier = 10;

   // 2000 ETH
   uint firstTierAmount = 2000 ether;
   // 8000 ETH
   uint secondTierAmount = 8000 ether;
   /* data structure to hold information about campaign contributors */
   /*  at initialization, setup the owner */
   function Crowdsale(
       address ifSuccessfulSendTo,
       uint fundingGoalInEthers,
       token addressOfTokenUsedAsReward
   ) {
       beneficiary = ifSuccessfulSendTo;
       fundingGoal = fundingGoalInEthers * 1 ether;
       tokenReward = token(addressOfTokenUsedAsReward);
       tokenMultiplier = tokenMultiplier**tokenReward.decimals();
   }
   /* The function without name is the default function that is called whenever anyone sends funds to a contract */
   function () payable {
       if (crowdsaleClosed) throw;
       if (amountRaised <= firstTierAmount) {
           tokenPrice = 4 finney;
       } else {
           if (amountRaised <= secondTierAmount) {
               tokenPrice = 6 finney;
           } else {
               tokenPrice = 10 finney;
           }
       }
       price = tokenPrice / tokenMultiplier;
       uint costPercent;
       uint amount = msg.value;
       balanceOf[msg.sender] = amount;
       amountRaised += amount;
       tokenReward.mintToken(msg.sender, amount / price);
       tokenReward.mintToken(beneficiary, amount / price * 43 / 100);
       FundTransfer(msg.sender, amount, true);
       if((amount % price) > 0)
       {
           amountRaised -= amount % price;
           if (msg.sender.send(amount % price)){
               FundTransfer(msg.sender, amount % price, false);
           }
       }
   }
   modifier afterDeadline() { if (now >= deadline) _; }
   /* checks if the goal or time limit has been reached and ends the campaign */
   function checkGoalReached() afterDeadline {
       if (amountRaised >= fundingGoal){
           fundingGoalReached = true;
           GoalReached(beneficiary, amountRaised);
       }
       crowdsaleClosed = true;
   }
   function safeWithdrawal() afterDeadline {
       if (!fundingGoalReached) {
           uint amount = balanceOf[msg.sender];
           balanceOf[msg.sender] = 0;
           if (amount > 0) {
               if (msg.sender.send(amount)) {
                   FundTransfer(msg.sender, amount, false);
               } else {
                   balanceOf[msg.sender] = amount;
               }
           }
       }
       if (fundingGoalReached && beneficiary == msg.sender) {
           if (beneficiary.send(amountRaised)) {
               FundTransfer(beneficiary, amountRaised, false);
           } else {
               //If we fail to send the funds to beneficiary, unlock funders balance
               fundingGoalReached = false;
           }
       }
   }
}
