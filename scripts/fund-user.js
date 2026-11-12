const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const userMetaMask = "0x3d26ffb01c208e8a804fbb3cf0ab4383933e8708";
  const mockUsdcAddress = "0xA61ABC464034161B4C5abAee7298c1503cF6E199";

  console.log(`Funding user MetaMask wallet: ${userMetaMask}`);

  // 1. Send 0.2 AVAX for gas
  const txAvax = await deployer.sendTransaction({
    to: userMetaMask,
    value: hre.ethers.parseEther("0.2"),
  });
  console.log(`Sent 0.2 AVAX tx: ${txAvax.hash}`);
  await txAvax.wait();

  // 2. Mint 500 MockUSDC
  const usdc = await hre.ethers.getContractAt("MockUSDC", mockUsdcAddress);
  const txUsdc = await usdc.mint(userMetaMask, hre.ethers.parseUnits("500", 6));
  console.log(`Minted 500 MockUSDC tx: ${txUsdc.hash}`);
  await txUsdc.wait();

  console.log("SUCCESS! User MetaMask is fully funded on Avalanche Fuji!");
}

main().catch(console.error);
