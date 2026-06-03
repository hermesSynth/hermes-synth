import { ethers } from "ethers";
import { readFileSync } from "fs";

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const RPC = "https://mainnet.base.org";

const abi = JSON.parse(readFileSync("/home/ubuntu/hermes-agent-deploy/x402-privacy/build_v2/contracts_X402PrivacyPoolV2_sol_X402PrivacyPoolV2.abi", "utf8"));
const bytecode = "0x" + readFileSync("/home/ubuntu/hermes-agent-deploy/x402-privacy/build_v2/contracts_X402PrivacyPoolV2_sol_X402PrivacyPoolV2.bin", "utf8").trim();

const provider = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

console.log("Deployer:", wallet.address);
const bal = await provider.getBalance(wallet.address);
console.log("ETH balance:", ethers.formatEther(bal));

const factory = new ethers.ContractFactory(abi, bytecode, wallet);
console.log("Deploying X402PrivacyPoolV2...");
const contract = await factory.deploy(USDC_BASE);
console.log("TX:", contract.deploymentTransaction().hash);
await contract.waitForDeployment();
const addr = await contract.getAddress();
console.log("X402PrivacyPoolV2 deployed to:", addr);
