pragma solidity ^0.4.2;
contract owned {
  address public owner;
  function owned() {
    owner = msg.sender;
  }
  function changeOwner(address newOwner) onlyowner {
    owner = newOwner;
  }
  modifier onlyowner() {
    if (msg.sender==owner) _;
  }
}
contract tokenRecipient { function receiveApproval(address _from, uint256 _value, address _token, bytes _extraData); }
contract CSToken is owned {
    /* Public variables of the token */
    string public standard = 'Token 0.1';
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;
    /* This creates an array with all balances */
    mapping (address => uint256) public balanceOf;
    mapping (address => mapping (address => uint256)) public allowance;
    /* This generates a public event on the blockchain that will notify clients */
    event Transfer(address indexed from, address indexed to, uint256 value);
    /* Initializes contract with initial supply tokens to the creator of the contract */
    function CSToken(
        uint256 initialSupply,
        string tokenName,
        uint8 decimalUnits,
        string tokenSymbol
        ) {
        owner = msg.sender;
        balanceOf[msg.sender] = initialSupply;              // Give the creator all initial tokens
        totalSupply = initialSupply;                        // Update total supply
        name = tokenName;                                   // Set the name for display purposes
        symbol = tokenSymbol;                               // Set the symbol for display purposes
        decimals = decimalUnits;                            // Amount of decimals for display purposes
    }
    /* Send coins */
    function transfer(address _to, uint256 _value) {
        if (balanceOf[msg.sender] < _value) throw;           // Check if the sender has enough
        if (balanceOf[_to] + _value < balanceOf[_to]) throw; // Check for overflows
        balanceOf[msg.sender] -= _value;                     // Subtract from the sender
        balanceOf[_to] += _value;                            // Add the same to the recipient
        Transfer(msg.sender, _to, _value);                   // Notify anyone listening that this transfer took place
    }
    function mintToken(address target, uint256 mintedAmount) onlyowner {
    balanceOf[target] += mintedAmount;
    totalSupply += mintedAmount;
    Transfer(0, owner, mintedAmount);
    Transfer(owner, target, mintedAmount);
    }
    /* Allow another contract to spend some tokens in your behalf */
    function approve(address _spender, uint256 _value)
        returns (bool success) {
        allowance[msg.sender][_spender] = _value;
        return true;
    }
    /* Approve and then comunicate the approved contract in a single tx */
    function approveAndCall(address _spender, uint256 _value, bytes _extraData)
        returns (bool success) {
        tokenRecipient spender = tokenRecipient(_spender);
        if (approve(_spender, _value)) {
            spender.receiveApproval(msg.sender, _value, this, _extraData);
            return true;
        }
    }
    /* A contract attempts to get the coins */
    function transferFrom(address _from, address _to, uint256 _value) returns (bool success) {
        if (balanceOf[_from] < _value) throw;                 // Check if the sender has enough
        if (balanceOf[_to] + _value < balanceOf[_to]) throw;  // Check for overflows
        if (_value > allowance[_from][msg.sender]) throw;   // Check allowance
        balanceOf[_from] -= _value;                          // Subtract from the sender
        balanceOf[_to] += _value;                            // Add the same to the recipient
        allowance[_from][msg.sender] -= _value;
        Transfer(_from, _to, _value);
        return true;
    }
    /* This unnamed function is called whenever someone tries to send ether to it */
    function () {
        throw;     // Prevents accidental sending of ether
    }
}
contract Crowdsale is owned{
    uint public currentStage = 0;
    uint[] public tresholds;
    uint[] public prices;
    address[] funders;
    uint256[] public amounts;
    address public beneficiary;
    address public founders;
    uint public amountRaised;
    uint public deadline;
    uint public presaleDeadline;
    uint public tokensRaised;
    CSToken public tokenReward;
    mapping(address => uint256) public balanceOf;
    mapping(address => address) public presaleContracts;
    mapping(address => uint256) public presaleBalance;
    event GoalReached(address beneficiary, uint amountRaised);
    event FundTransfer(address backer, uint amount, bool isContribution);
    address[] public presales;
    address expectedGather;
    mapping(address => uint) presaleIndex;

    modifier afterDeadline() { if (now >= deadline) _; }
    modifier onPresale() { if (now < presaleDeadline) _; }

    function Crowdsale(
        uint durationInMinutes,
        uint presaleDuration,
        address _beneficiary,
        address _founders
    ) {
        tresholds.push(45000000);
        tresholds.push(95000000);
        tresholds.push(155000000);
        tresholds.push(225000000);
        tresholds.push(2**256 - 1);
        prices.push(7500 szabo);
        prices.push(8500 szabo);
        prices.push(9 finney);
        prices.push(10 finney);
        prices.push(2**256 - 1);
        presaleDeadline = now + presaleDuration * 1 minutes;
        beneficiary = msg.sender;
        deadline = now + (durationInMinutes + presaleDuration) * 1 minutes;
        tokenReward = new CSToken(0, '0', 0, '0');
        presales.push(new Presale(presaleDeadline));
        founders = _founders;
        beneficiary = _beneficiary;
    }
    function processPayment(address from, uint amount) internal
    {
        FundTransfer(from, amount, false);
        uint price = prices[currentStage];
        if (currentStage == 0 && amount < 2500 ether)
            price = prices[currentStage + 1];
        uint256 tokenAmount = amount / price;

        if (tokensRaised + tokenAmount > tresholds[currentStage])
        {
            uint256 currentTokens = tresholds[currentStage] - tokensRaised;
            uint256 currentAmount = currentTokens * price;
            balanceOf[from] += amount;
            tokensRaised += currentTokens;
            amountRaised += currentAmount;

            tokenReward.mintToken(from, currentTokens);
            tokenReward.mintToken(beneficiary, amount / price * 29 / 100);
            tokenReward.mintToken(founders, amount / price * 14 / 100);
            FundTransfer(from, amount, true);
            currentStage++;
            processPayment(from, amount - currentAmount);
            return;
        }
        balanceOf[from] += amount;
        amountRaised += amount;
        tokensRaised += tokenAmount;
        tokenReward.mintToken(from, tokenAmount);
        tokenReward.mintToken(beneficiary, amount / price * 29 / 100);
        tokenReward.mintToken(founders, amount / price * 14 / 100);
        FundTransfer(from, amount, true);
        uint256 change = amount - tokenAmount * price;
        if(change > 0)
        {
            amountRaised -= change;
            balanceOf[from] -= change;
            if (from.send(change)){
                FundTransfer(from, change, false);
            }
        }
    }

    function () payable {
        if (currentStage == 0)
            if (msg.sender == expectedGather) {return;} else {throw;}
        if (now > deadline) throw;
        processPayment(msg.sender, msg.value);
    }

    function startCampaign() onlyowner {
        if (currentStage > 0) throw;
        for (uint i = 0; i < presales.length; i++){
            expectedGather = presales[i];
            Presale(presales[i]).collectBalances();
            expectedGather = 0;
        }
        for (uint g = 0; g < funders.length; g++){
            processPayment(funders[g], this.amounts(g));
        }
        if (currentStage == 0)
            currentStage++;
    }

    function createPresale(address payer) onPresale returns (address) {
        Presale ps = new Presale(presaleDeadline);
        presales.push(ps);
        presaleContracts[payer] = ps;
        return ps;
    }

    function fundPresale(address funder, uint balance) onPresale {
        bool found = false;
        for (uint i = 0; i < presales.length; i++)
        {
           if (presales[i] == msg.sender) {found = true; break;}
        }
        if (!found) throw;
        if (presaleBalance[funder] == 0)
        {
            funders.push(funder);
            amounts.push(balance);
            presaleIndex[funder] = amounts.length - 1;
            presaleBalance[funder] = balance;
        } else
        {
            amounts[presaleIndex[funder]] += balance;
            presaleBalance[funder] += balance;
        }

    }
    function safeWithdrawal() afterDeadline {
        if (beneficiary == msg.sender) {
            if (beneficiary.send(amountRaised)) {
                FundTransfer(beneficiary, amountRaised, false);
            }
        }
    }
}
contract Presale is owned{
    uint saleStart;
    uint256 minimalPrice = 75000 szabo;
    modifier beforeStart() {if (now >= saleStart) throw; _;}
    modifier afterStart() {if (now < saleStart) throw; _;}

    function Presale(uint _saleStart) payable
    {
        saleStart = _saleStart;
    }

    function () payable beforeStart
    {
        if (msg.value < minimalPrice) throw;

        Crowdsale(owner).fundPresale(msg.sender, msg.value);
    }

    function collectBalances() onlyowner afterStart{
        if (!Crowdsale(owner).send(this.balance)) throw;
    }
}

0x10Bb635Bf887dfcE8558964e2399D11a757bEd99
0x0a63b0E3e25600DdF0D4A9F357b911bbe961F65a
