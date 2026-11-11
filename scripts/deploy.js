const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log("==================================================");
  console.log(" UNIVERSAL CHECKOUT — DEPLOYING TO AVALANCHE FUJI");
  console.log("==================================================");
  console.log(`Deployer address : ${deployer.address}`);
  console.log(`Network          : ${network.name} (Chain ID: ${network.chainId})`);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance : ${hre.ethers.formatEther(balance)} AVAX`);

  const OFFICIAL_FUJI_USDC = "0x5425890298aed601595a70AB815c96711a31Bc65";

  // 1. Deploy MockUSDC on Fuji so anyone can mint test USDC freely
  console.log("\n1. Deploying MockUSDC (Free Test Faucet Token)...");
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const mockUsdc = await MockUSDC.deploy();
  await mockUsdc.waitForDeployment();
  const mockUsdcAddress = await mockUsdc.getAddress();
  console.log(`   MockUSDC Address : ${mockUsdcAddress}`);
  console.log(`   Explorer Link    : https://testnet.snowtrace.io/address/${mockUsdcAddress}`);

  // 2. Deploy PaymentRouter
  const backendSignerAddress = process.env.BACKEND_SIGNER_ADDRESS || deployer.address;
  console.log(`\n2. Deploying PaymentRouter...`);
  console.log(`   Backend Signer   : ${backendSignerAddress}`);
  console.log(`   Initial Token    : ${mockUsdcAddress}`);

  const PaymentRouter = await hre.ethers.getContractFactory("PaymentRouter");
  const router = await PaymentRouter.deploy(
    backendSignerAddress,
    deployer.address,
    mockUsdcAddress
  );
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  const txHash = router.deploymentTransaction().hash;

  console.log(`   PaymentRouter Address: ${routerAddress}`);
  console.log(`   Deployment Tx Hash   : ${txHash}`);
  console.log(`   Explorer Link        : https://testnet.snowtrace.io/address/${routerAddress}`);

  // 3. Whitelist Circle's Official USDC on Fuji as well
  console.log(`\n3. Whitelisting Official Circle USDC (${OFFICIAL_FUJI_USDC})...`);
  const whitelistTx = await router.setTokenSupport(OFFICIAL_FUJI_USDC, true);
  await whitelistTx.wait();
  console.log(`    Official Circle USDC whitelisted successfully!`);

  console.log("\n==================================================");
  console.log(" DEPLOYMENT COMPLETE & READY FOR INTEGRATION");
  console.log("==================================================");
  console.log(`PaymentRouter        : ${routerAddress}`);
  console.log(`MockUSDC (Free mint) : ${mockUsdcAddress}`);
  console.log(`Official Circle USDC : ${OFFICIAL_FUJI_USDC}`);
  console.log(`Backend Signer       : ${backendSignerAddress}`);
  console.log(`Chain ID             : 43113 (Avalanche Fuji)`);

  // Export deployment artifact for Backend and Frontend integration
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const routerArtifact = await hre.artifacts.readArtifact("PaymentRouter");
  const mockUsdcArtifact = await hre.artifacts.readArtifact("MockUSDC");

  const deploymentInfo = {
    network: "Avalanche Fuji C-Chain",
    chainId: Number(network.chainId),
    paymentRouter: routerAddress,
    mockUsdc: mockUsdcAddress,
    officialCircleUsdc: OFFICIAL_FUJI_USDC,
    backendSigner: backendSignerAddress,
    deployer: deployer.address,
    transactionHash: txHash,
    deployedAt: new Date().toISOString(),
    explorerLinks: {
      router: `https://testnet.snowtrace.io/address/${routerAddress}`,
      mockUsdc: `https://testnet.snowtrace.io/address/${mockUsdcAddress}`,
      tx: `https://testnet.snowtrace.io/tx/${txHash}`,
    },
    routerAbi: routerArtifact.abi,
    mockUsdcAbi: mockUsdcArtifact.abi,
  };

  const outputPath = path.join(deploymentsDir, `deployment-43113.json`);
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\nDeployment info & ABI saved to: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
