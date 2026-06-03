const solc = require("solc");
const fs = require("fs");
const path = require("path");

// Read contract sources
const verifierSource = fs.readFileSync(path.join(__dirname, "../contracts/Groth16Verifier.sol"), "utf8");
const poolSource = fs.readFileSync(path.join(__dirname, "../contracts/X402PrivacyPool.sol"), "utf8");

const input = {
  language: "Solidity",
  sources: {
    "Groth16Verifier.sol": { content: verifierSource },
    "X402PrivacyPool.sol": { content: poolSource }
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode.object"]
      }
    }
  }
};

console.log("Compiling contracts...");
const output = JSON.parse(solc.compile(JSON.stringify(input)));

// Check for errors
if (output.errors) {
  const errors = output.errors.filter(e => e.severity === "error");
  if (errors.length > 0) {
    console.error("Compilation errors:");
    errors.forEach(e => console.error(e.formattedMessage));
    process.exit(1);
  }
  // Print warnings
  output.errors.filter(e => e.severity === "warning").forEach(e => {
    console.warn("Warning:", e.message);
  });
}

// Save artifacts
const buildDir = path.join(__dirname, "../build");
fs.mkdirSync(buildDir, { recursive: true });

// Verifier
const verifierContract = output.contracts["Groth16Verifier.sol"]["Groth16Verifier"];
fs.writeFileSync(
  path.join(buildDir, "Groth16Verifier.json"),
  JSON.stringify({
    abi: verifierContract.abi,
    bytecode: "0x" + verifierContract.evm.bytecode.object
  }, null, 2)
);
console.log("✓ Groth16Verifier compiled");

// Pool
const poolContract = output.contracts["X402PrivacyPool.sol"]["X402PrivacyPool"];
fs.writeFileSync(
  path.join(buildDir, "X402PrivacyPool.json"),
  JSON.stringify({
    abi: poolContract.abi,
    bytecode: "0x" + poolContract.evm.bytecode.object
  }, null, 2)
);
console.log("✓ X402PrivacyPool compiled");
console.log("\nArtifacts saved to build/");
