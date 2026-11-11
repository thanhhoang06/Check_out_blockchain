const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log("==================================================");
  console.log(" TESTING LIVE PAYMENT ON AVALANCHE FUJI C-CHAIN");
  console.log("==================================================");
  console.log(`Caller / Buyer / Signer : ${signer.address}`);
  console.log(`Network                 : ${network.name} (Chain ID: ${network.chainId})`);

  // Target addresses deployed on Fuji
  const routerAddress = "0xC83FA9cEcf7fc125dbeC893402c6f0f5e3f5AeE9";
  const mockUsdcAddress = "0xA61ABC464034161B4C5abAee7298c1503cF6E199";
  const merchantAddress = "0x000000000000000000000000000000000000dEaD"; // Destination merchant wallet

  const router = await hre.ethers.getContractAt("PaymentRouter", routerAddress);
  const usdc = await hre.ethers.getContractAt("MockUSDC", mockUsdcAddress);

  const amount = hre.ethers.parseUnits("15.5", 6); // 15.50 USDC
  const paymentId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(`live_fuji_order_${Date.now()}`));
  const latestBlock = await hre.ethers.provider.getBlock("latest");
  const deadline = latestBlock.timestamp + 3600;

  console.log(`\n1. Approving USDC allowance for PaymentRouter...`);
  const approveTx = await usdc.approve(routerAddress, amount);
  await approveTx.wait();
  console.log(`    Approve Tx Hash: ${approveTx.hash}`);

  console.log(`\n2. Signing EIP-712 PaymentIntent...`);
  const domain = {
    name: "UniversalCheckout",
    version: "1",
    chainId: Number(network.chainId),
    verifyingContract: routerAddress,
  };

  const types = {
    PaymentIntent: [
      { name: "paymentId", type: "bytes32" },
      { name: "buyer", type: "address" },
      { name: "merchant", type: "address" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  };

  const intent = {
    paymentId: paymentId,
    buyer: signer.address,
    merchant: merchantAddress,
    token: mockUsdcAddress,
    amount: amount,
    deadline: deadline,
  };

  const signature = await signer.signTypedData(domain, types, intent);
  console.log(`    PaymentIntent signed by ${signer.address}`);

  console.log(`\n3. Sending pay() transaction to Avalanche Fuji...`);
  const payTx = await router.pay(intent, signature);
  console.log(`   Transaction broadcasted! Tx Hash: ${payTx.hash}`);
  console.log(`   Waiting for Avalanche consensus...`);

  const receipt = await payTx.wait();
  console.log(`\n Transaction Mined Successfully!`);
  console.log(`--------------------------------------------------`);
  console.log(`Block Number : ${receipt.blockNumber}`);
  console.log(`Gas Used     : ${receipt.gasUsed.toString()}`);
  console.log(`Explorer Link: https://testnet.snowtrace.io/tx/${receipt.hash}`);
  console.log(`--------------------------------------------------`);

  // Query and display event
  const events = await router.queryFilter(router.filters.PaymentReceived(paymentId), receipt.blockNumber, receipt.blockNumber);
  if (events.length > 0) {
    const e = events[0];
    console.log(` Event PaymentReceived Confirmed On-Chain:`);
    console.log(`   - paymentId : ${e.args.paymentId}`);
    console.log(`   - buyer     : ${e.args.buyer}`);
    console.log(`   - merchant  : ${e.args.merchant}`);
    console.log(`   - token     : ${e.args.token}`);
    console.log(`   - amount    : ${hre.ethers.formatUnits(e.args.amount, 6)} USDC`);
  }
}

main().catch(console.error);
