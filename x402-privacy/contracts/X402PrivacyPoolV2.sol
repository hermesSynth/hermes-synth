// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

/// @title X402PrivacyPoolV2
/// @notice Commitment-based private payment pool for AI services on Base
/// @dev Deposits create commitments, withdrawals reveal preimage to claim
contract X402PrivacyPoolV2 {
    IERC20 public immutable token; // USDC on Base

    uint256 public constant FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

    // Fixed deposit amounts (in USDC with 6 decimals)
    uint256 public constant DEPOSIT_AMOUNT_1 = 10 * 1e6;   // 10 USDC
    uint256 public constant DEPOSIT_AMOUNT_2 = 100 * 1e6;  // 100 USDC
    uint256 public constant DEPOSIT_AMOUNT_3 = 1000 * 1e6; // 1000 USDC

    // Track commitments and their amounts
    mapping(uint256 => uint256) public commitmentAmounts; // commitment => amount (0 if not exists)
    
    // Nullifier tracking (prevents double-spend)
    mapping(uint256 => bool) public nullifierHashes;

    // Stats
    uint256 public depositCount;

    // Events
    event Deposit(uint256 indexed commitment, uint256 timestamp, uint256 amount);
    event Withdrawal(address to, uint256 nullifierHash, uint256 amount);

    constructor(address _token) {
        token = IERC20(_token);
    }

    function _hash(uint256 a, uint256 b) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(a, b))) % FIELD_SIZE;
    }

    /// @notice Deposit USDC into the privacy pool
    function deposit(uint256 commitment, uint256 amount) external {
        require(commitmentAmounts[commitment] == 0, "Commitment already exists");
        require(commitment < FIELD_SIZE, "Invalid commitment");
        require(
            amount == DEPOSIT_AMOUNT_1 || 
            amount == DEPOSIT_AMOUNT_2 || 
            amount == DEPOSIT_AMOUNT_3,
            "Invalid deposit amount"
        );

        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        commitmentAmounts[commitment] = amount;
        depositCount++;

        emit Deposit(commitment, block.timestamp, amount);
    }

    /// @notice Withdraw by revealing secret + nullifier
    function withdraw(
        uint256 _secret,
        uint256 _nullifier,
        address _recipient,
        uint256 _amount
    ) external {
        // Compute commitment from secret + nullifier
        uint256 commitment = _hash(_secret, _nullifier);
        require(commitmentAmounts[commitment] == _amount, "Invalid commitment or amount");

        // Compute nullifier hash
        uint256 nullHash = _hash(_nullifier, 1);
        require(!nullifierHashes[nullHash], "Already spent");

        // Mark as spent
        nullifierHashes[nullHash] = true;

        // Transfer funds
        require(token.transfer(_recipient, _amount), "Transfer failed");

        emit Withdrawal(_recipient, nullHash, _amount);
    }

    /// @notice Get pool balance
    function getPoolBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /// @notice Get number of deposits
    function getDepositCount() external view returns (uint256) {
        return depositCount;
    }

    /// @notice Check if a commitment exists and its amount
    function getCommitmentAmount(uint256 commitment) external view returns (uint256) {
        return commitmentAmounts[commitment];
    }
}
