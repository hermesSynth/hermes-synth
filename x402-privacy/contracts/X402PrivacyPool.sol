// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Groth16Verifier.sol";

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title X402PrivacyPool
/// @notice Zero-knowledge private payment pool for AI services on Base
/// @dev Uses Poseidon hash-based Merkle tree with Groth16 ZK proofs
contract X402PrivacyPool {
    Groth16Verifier public immutable verifier;
    IERC20 public immutable token; // USDC on Base

    uint256 public constant MERKLE_TREE_LEVELS = 20;
    uint256 public constant FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

    // Fixed deposit amounts (in USDC with 6 decimals)
    uint256 public constant DEPOSIT_AMOUNT_1 = 10 * 1e6;   // 10 USDC
    uint256 public constant DEPOSIT_AMOUNT_2 = 100 * 1e6;  // 100 USDC
    uint256 public constant DEPOSIT_AMOUNT_3 = 1000 * 1e6; // 1000 USDC

    // Merkle tree storage
    uint256 public nextIndex;
    mapping(uint256 => uint256) public filledSubtrees;
    mapping(uint256 => uint256) public roots;
    uint256 public currentRootIndex;
    uint256 public constant ROOT_HISTORY_SIZE = 30;

    // Nullifier tracking (prevents double-spend)
    mapping(uint256 => bool) public nullifierHashes;

    // Commitment tracking
    mapping(uint256 => bool) public commitments;

    // Zero values for each level of the Merkle tree (Poseidon hash of 0)
    uint256[21] public zeros;

    // Events
    event Deposit(uint256 indexed commitment, uint256 leafIndex, uint256 timestamp, uint256 amount);
    event Withdrawal(address to, uint256 nullifierHash, uint256 amount);

    constructor(address _verifier, address _token) {
        verifier = Groth16Verifier(_verifier);
        token = IERC20(_token);

        // Initialize zero values (Poseidon hashes)
        // zeros[0] = hash of empty leaf
        zeros[0] = uint256(keccak256(abi.encodePacked("x402_empty_leaf"))) % FIELD_SIZE;
        for (uint256 i = 1; i <= MERKLE_TREE_LEVELS; i++) {
            zeros[i] = _hashPair(zeros[i-1], zeros[i-1]);
        }

        // Initialize root
        roots[0] = zeros[MERKLE_TREE_LEVELS];
    }

    /// @notice Deposit USDC into the privacy pool
    /// @param commitment The Poseidon hash commitment (hash of secret + nullifier)
    /// @param amount The deposit amount (must be one of the fixed amounts)
    function deposit(uint256 commitment, uint256 amount) external {
        require(!commitments[commitment], "Commitment already exists");
        require(commitment < FIELD_SIZE, "Invalid commitment");
        require(
            amount == DEPOSIT_AMOUNT_1 || 
            amount == DEPOSIT_AMOUNT_2 || 
            amount == DEPOSIT_AMOUNT_3,
            "Invalid deposit amount"
        );
        require(nextIndex < 2**MERKLE_TREE_LEVELS, "Merkle tree is full");

        // Transfer USDC from depositor
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        // Insert into Merkle tree
        uint256 leafIndex = nextIndex;
        uint256 currentHash = commitment;

        for (uint256 i = 0; i < MERKLE_TREE_LEVELS; i++) {
            if (leafIndex % 2 == 0) {
                filledSubtrees[i] = currentHash;
                currentHash = _hashPair(currentHash, zeros[i]);
            } else {
                currentHash = _hashPair(filledSubtrees[i], currentHash);
            }
            leafIndex /= 2;
        }

        // Update root
        currentRootIndex = (currentRootIndex + 1) % ROOT_HISTORY_SIZE;
        roots[currentRootIndex] = currentHash;

        commitments[commitment] = true;
        nextIndex++;

        emit Deposit(commitment, nextIndex - 1, block.timestamp, amount);
    }

    /// @notice Withdraw privately using a ZK proof
    function withdraw(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256 root,
        uint256 nullifierHash,
        address recipient,
        uint256 amount
    ) external {
        require(!nullifierHashes[nullifierHash], "Already spent");
        require(isKnownRoot(root), "Invalid root");
        require(
            amount == DEPOSIT_AMOUNT_1 || 
            amount == DEPOSIT_AMOUNT_2 || 
            amount == DEPOSIT_AMOUNT_3,
            "Invalid amount"
        );

        // Verify ZK proof
        uint256[4] memory input = [
            root,
            nullifierHash,
            uint256(uint160(recipient)),
            amount
        ];

        require(verifier.verifyProof(a, b, c, input), "Invalid proof");

        // Mark nullifier as spent
        nullifierHashes[nullifierHash] = true;

        // Transfer funds to recipient
        require(token.transfer(recipient, amount), "Transfer failed");

        emit Withdrawal(recipient, nullifierHash, amount);
    }

    /// @notice Check if a root is in the recent history
    function isKnownRoot(uint256 root) public view returns (bool) {
        if (root == 0) return false;
        uint256 idx = currentRootIndex;
        for (uint256 i = 0; i < ROOT_HISTORY_SIZE; i++) {
            if (roots[idx] == root) return true;
            if (idx == 0) idx = ROOT_HISTORY_SIZE - 1;
            else idx--;
        }
        return false;
    }

    /// @notice Get current Merkle root
    function getLastRoot() external view returns (uint256) {
        return roots[currentRootIndex];
    }

    /// @notice Hash two values (simplified — in production use Poseidon precompile)
    function _hashPair(uint256 left, uint256 right) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(left, right))) % FIELD_SIZE;
    }

    /// @notice Get pool balance
    function getPoolBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /// @notice Get number of deposits
    function getDepositCount() external view returns (uint256) {
        return nextIndex;
    }
}
