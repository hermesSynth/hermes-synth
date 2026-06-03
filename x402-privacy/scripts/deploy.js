const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function main() {
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  if (!PRIVATE_KEY) {
    console.error("Set PRIVATE_KEY env variable");
    process.exit(1);
  }

  // Base mainnet
  const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log("Deployer:", wallet.address);
  const balance = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    console.error("No ETH balance for gas!");
    process.exit(1);
  }

  // USDC on Base
  const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

  // Load artifacts
  const verifierArtifact = JSON.parse(fs.readFileSync(path.join(__dirname, "../build/Groth16Verifier.json")));
  const poolArtifact = JSON.parse(fs.readFileSync(path.join(__dirname, "../build/X402PrivacyPool.json")));

  // 1. Deploy Verifier
  console.log("\n1. Deploying Groth16Verifier...");
  const VerifierFactory = new ethers.ContractFactory(verifierArtifact.abi, verifierArtifact.bytecode, wallet);
  const verifier = await VerifierFactory.deploy();
  await verifier.waitForDeployment();
  const verifierAddr = await verifier.getAddress();
  console.log("   Verifier:", verifierAddr);

  // 2. Deploy Pool
  console.log("\n2. Deploying X402PrivacyPool...");
  const PoolFactory = new ethers.ContractFactory(poolArtifact.abi, poolArtifact.bytecode, wallet);
  const pool = await PoolFactory.deploy(verifierAddr, USDC_BASE);
  await pool.waitForDeployment();
  const poolAddr = await pool.getAddress();
  console.log("   Pool:", poolAddr);

  // Save
  const deployment = {
    network: "base",
    chainId: 8453,
    verifier: verifierAddr,
    pool: poolAddr,
    token: USDC_BASE,
    deployer: wallet.address,
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync(path.join(__dirname, "../deployment.json"), JSON.stringify(deployment, null, 2));

  console.log("\n--- Deployed ---");
  console.log(JSON.stringify(deployment, null, 2));
}

main().catch(console.error);
