const { ethers } = require("hardhat");

/**
 * Example script for Backend & Frontend teams showing how to create and sign
 * a PaymentIntent conforming to EIP-712 standard for Universal Checkout.
 */
async function main() {
  console.log("=== Universal Checkout EIP-712 Signature Generator Example ===");

  // In production, backendSigner is initialized with backend's private key
  const [signer, buyer, merchant] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  const routerAddress = "0x1234567890123456789012345678901234567890"; // Replace with deployed router address
  const usdcAddress = "0x5425890298aed601595a70AB815c96711a31Bc65"; // Fuji Circle USDC

  // 1. Define EIP-712 Domain
  const domain = {
    name: "UniversalCheckout",
    version: "1",
    chainId: chainId,
    verifyingContract: routerAddress,
  };

  // 2. Define Types
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

  // 3. Define PaymentIntent values
  const paymentId = ethers.keccak256(ethers.toUtf8Bytes("shopify_draft_order_99882233"));
  const amount = ethers.parseUnits("49.99", 6); // $49.99 USDC (6 decimals: 49990000)
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const deadline = currentTimestamp + 3600; // valid for 1 hour

  const intent = {
    paymentId: paymentId,
    buyer: buyer.address,
    merchant: merchant.address,
    token: usdcAddress,
    amount: amount.toString(),
    deadline: deadline,
  };

  // 4. Sign typed data using backend signer
  const signature = await signer.signTypedData(domain, types, intent);

  console.log("\n1. Domain Separator Input:", JSON.stringify(domain, null, 2));
  console.log("\n2. PaymentIntent Struct:", JSON.stringify(intent, null, 2));
  console.log("\n3. Generated Signature:", signature);
  console.log("\n4. Backend Signer Address:", signer.address);

  console.log("\n=== Integration Payload for Frontend Hosted Checkout ===");
  const frontendPayload = {
    contractAddress: routerAddress,
    intent: intent,
    signature: signature,
  };
  console.log(JSON.stringify(frontendPayload, null, 2));
}

main().catch(console.error);
