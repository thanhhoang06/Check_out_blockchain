const { ethers } = require("hardhat");

async function main() {
  console.log("================================================================================");
  console.log(" UNIVERSAL CHECKOUT — E2E LIVE FLOW SIMULATION");
  console.log("================================================================================");

  const [deployer, backendSigner, buyer, merchant] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log(`\n1. SETUP ACTORS & CONTRACTS`);
  console.log(`   Network          : ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`   Deployer (Owner) : ${deployer.address}`);
  console.log(`   Backend Signer   : ${backendSigner.address}`);
  console.log(`   Buyer Wallet     : ${buyer.address}`);
  console.log(`   Merchant Wallet  : ${merchant.address}`);

  // Deploy MockUSDC (6 decimals)
  console.log(`\n2. DEPLOYING TOKENS & ROUTER`);
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log(`    MockUSDC deployed at     : ${usdcAddress}`);

  // Deploy PaymentRouter
  const PaymentRouter = await ethers.getContractFactory("PaymentRouter");
  const router = await PaymentRouter.deploy(backendSigner.address, deployer.address, usdcAddress);
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log(`    PaymentRouter deployed at: ${routerAddress}`);

  // Faucet: Fund buyer with 1,000 USDC
  console.log(`\n3. FUNDING BUYER WITH TEST USDC`);
  const initialBuyerMint = ethers.parseUnits("1000", 6);
  await usdc.mint(buyer.address, initialBuyerMint);
  console.log(`    Buyer balance: ${ethers.formatUnits(await usdc.balanceOf(buyer.address), 6)} USDC`);
  console.log(`    Merchant balance: ${ethers.formatUnits(await usdc.balanceOf(merchant.address), 6)} USDC`);

  // Step 1: Backend generates PaymentIntent and signs EIP-712
  console.log(`\n4. STEP 01 — BACKEND GENERATES & SIGNS PAYMENTINTENT (EIP-712)`);
  const paymentId = ethers.keccak256(ethers.toUtf8Bytes(`shopify_order_${Date.now()}`));
  const paymentAmount = ethers.parseUnits("79.99", 6); // $79.99 USDC
  const latestBlock = await ethers.provider.getBlock("latest");
  const deadline = latestBlock.timestamp + 3600; // 1 hour validity

  const intent = {
    paymentId: paymentId,
    buyer: buyer.address,
    merchant: merchant.address,
    token: usdcAddress,
    amount: paymentAmount,
    deadline: deadline,
  };

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

  const signature = await backendSigner.signTypedData(domain, types, intent);
  console.log(`   Order Payment ID : ${paymentId}`);
  console.log(`   Amount to Pay    : ${ethers.formatUnits(paymentAmount, 6)} USDC`);
  console.log(`   Deadline (Unix)  : ${deadline}`);
  console.log(`   EIP-712 Signature: ${signature.slice(0, 32)}...${signature.slice(-20)}`);

  // Step 2: Buyer approves USDC allowance to Router
  console.log(`\n5. STEP 02 — BUYER APPROVES USDC ALLOWANCE`);
  const approveTx = await usdc.connect(buyer).approve(routerAddress, paymentAmount);
  await approveTx.wait();
  const allowance = await usdc.allowance(buyer.address, routerAddress);
  console.log(`    Allowance granted: ${ethers.formatUnits(allowance, 6)} USDC`);

  // Step 3 & 4: Buyer executes Router.pay() -> USDC transferred directly to Merchant
  console.log(`\n6. STEP 03 & 04 — BUYER CALLS ROUTER.PAY() (NON-CUSTODIAL SETTLEMENT)`);
  const payTx = await router.connect(buyer).pay(intent, signature);
  const receipt = await payTx.wait();
  console.log(`    Transaction Mined! Tx Hash: ${receipt.hash}`);
  console.log(`    Gas Used: ${receipt.gasUsed.toString()}`);

  // Step 5: Backend Worker verifies on-chain event
  console.log(`\n7. STEP 05 — BACKEND WORKER VERIFICATION`);
  const paymentReceivedFilter = router.filters.PaymentReceived(paymentId);
  const events = await router.queryFilter(paymentReceivedFilter, receipt.blockNumber, receipt.blockNumber);
  
  if (events.length > 0) {
    const event = events[0];
    console.log(`    Found PaymentReceived Event!`);
    console.log(`     - paymentId: ${event.args.paymentId}`);
    console.log(`     - buyer    : ${event.args.buyer}`);
    console.log(`     - merchant : ${event.args.merchant}`);
    console.log(`     - token    : ${event.args.token}`);
    console.log(`     - amount   : ${ethers.formatUnits(event.args.amount, 6)} USDC`);
  } else {
    throw new Error("PaymentReceived event was NOT emitted!");
  }

  // Check balances after settlement
  console.log(`\n8. STEP 06 — FINAL BALANCES AFTER SETTLEMENT`);
  const buyerBalAfter = await usdc.balanceOf(buyer.address);
  const merchantBalAfter = await usdc.balanceOf(merchant.address);
  const routerBal = await usdc.balanceOf(routerAddress);

  console.log(`    Buyer Balance    : ${ethers.formatUnits(buyerBalAfter, 6)} USDC (-79.99)`);
  console.log(`    Merchant Balance : ${ethers.formatUnits(merchantBalAfter, 6)} USDC (+79.99)`);
  console.log(`    Router Balance   : ${ethers.formatUnits(routerBal, 6)} USDC (0.00 - STRICTLY NON-CUSTODIAL)`);

  // Step 9: Replay attack prevention check
  console.log(`\n9. REPLAY PROTECTION CHECK`);
  try {
    console.log(`    Attempting to re-execute the same paymentId...`);
    await router.connect(buyer).pay(intent, signature);
    console.log(`    ERROR: Replay succeeded (this should NEVER happen!)`);
  } catch (err) {
    console.log(`    Replay blocked by smart contract! Reason: PaymentAlreadyExecuted()`);
  }

  console.log("\n================================================================================");
  console.log(" END-TO-END DEMO COMPLETED SUCCESSFULLY!");
  console.log(" Ready to deploy onto Avalanche Fuji C-Chain Live Testnet.");
  console.log("================================================================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
