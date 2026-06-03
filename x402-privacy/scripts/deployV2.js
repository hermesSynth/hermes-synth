const hre = require("hardhat");

async function main() {
  const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  
  console.log("Deploying X402PrivacyPoolV2...");
  
  const V2 = await hre.ethers.getContractFactory("X402PrivacyPoolV2");
  const pool = await V2.deploy(USDC_BASE);
  await pool.waitForDeployment();
  
  const addr = await pool.getAddress();
  console.log("X402PrivacyPoolV2 deployed to:", addr);
  
  // Save deployment info
  const fs = require("fs");
  const info = {
    v2_pool: addr,
    usdc: USDC_BASE,
    network: "base",
    chainId: 8453,
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync("deployment_v2.json", JSON.stringify(info, null, 2));
  console.log("Deployment info saved to deployment_v2.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
