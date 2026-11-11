const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PaymentRouter Acceptance Tests", function () {
  let router, usdc;
  let owner, backendSigner, buyer, merchant, attacker;
  let chainId;

  const PAYMENT_INTENT_TYPES = {
    PaymentIntent: [
      { name: "paymentId", type: "bytes32" },
      { name: "buyer", type: "address" },
      { name: "merchant", type: "address" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  };

  async function getDomain(routerAddress, customChainId) {
    return {
      name: "UniversalCheckout",
      version: "1",
      chainId: customChainId !== undefined ? customChainId : chainId,
      verifyingContract: routerAddress,
    };
  }

  async function signIntent(signer, intent, routerAddress, customChainId) {
    const domain = await getDomain(routerAddress, customChainId);
    return await signer.signTypedData(domain, PAYMENT_INTENT_TYPES, intent);
  }

  beforeEach(async function () {
    [owner, backendSigner, buyer, merchant, attacker] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    chainId = Number(network.chainId);

    // Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    // Deploy PaymentRouter
    const PaymentRouter = await ethers.getContractFactory("PaymentRouter");
    router = await PaymentRouter.deploy(
      backendSigner.address,
      owner.address,
      await usdc.getAddress()
    );
    await router.waitForDeployment();

    // Mint 1,000 USDC to buyer (6 decimals)
    await usdc.mint(buyer.address, ethers.parseUnits("1000", 6));

    // Buyer approves router
    await usdc.connect(buyer).approve(await router.getAddress(), ethers.MaxUint256);
  });

  it("1. Valid payment: Merchant receives exact USDC and PaymentReceived event emitted", async function () {
    const paymentId = ethers.keccak256(ethers.toUtf8Bytes("order_1001"));
    const amount = ethers.parseUnits("50", 6); // 50 USDC
    const latestBlock = await ethers.provider.getBlock("latest");
    const deadline = latestBlock.timestamp + 3600; // 1 hour

    const intent = {
      paymentId: paymentId,
      buyer: buyer.address,
      merchant: merchant.address,
      token: await usdc.getAddress(),
      amount: amount,
      deadline: deadline,
    };

    const signature = await signIntent(backendSigner, intent, await router.getAddress());

    const merchantBalBefore = await usdc.balanceOf(merchant.address);
    const buyerBalBefore = await usdc.balanceOf(buyer.address);

    const tx = await router.connect(buyer).pay(intent, signature);
    await expect(tx)
      .to.emit(router, "PaymentReceived")
      .withArgs(paymentId, buyer.address, merchant.address, await usdc.getAddress(), amount);

    expect(await usdc.balanceOf(merchant.address)).to.equal(merchantBalBefore + amount);
    expect(await usdc.balanceOf(buyer.address)).to.equal(buyerBalBefore - amount);
    expect(await router.executedPayments(paymentId)).to.be.true;
  });

  it("2. Tampered signature or wrong signer: Revert with InvalidSigner", async function () {
    const paymentId = ethers.keccak256(ethers.toUtf8Bytes("order_1002"));
    const amount = ethers.parseUnits("25", 6);
    const latestBlock = await ethers.provider.getBlock("latest");
    const deadline = latestBlock.timestamp + 3600;

    const intent = {
      paymentId: paymentId,
      buyer: buyer.address,
      merchant: merchant.address,
      token: await usdc.getAddress(),
      amount: amount,
      deadline: deadline,
    };

    // Signed by attacker instead of backendSigner
    const invalidSignature = await signIntent(attacker, intent, await router.getAddress());

    await expect(
      router.connect(buyer).pay(intent, invalidSignature)
    ).to.be.revertedWithCustomError(router, "InvalidSigner");
  });

  it("3. Expired PaymentIntent: Revert with PaymentExpired", async function () {
    const paymentId = ethers.keccak256(ethers.toUtf8Bytes("order_1003"));
    const amount = ethers.parseUnits("20", 6);
    const latestBlock = await ethers.provider.getBlock("latest");
    const deadline = latestBlock.timestamp - 10; // Expired 10 seconds ago

    const intent = {
      paymentId: paymentId,
      buyer: buyer.address,
      merchant: merchant.address,
      token: await usdc.getAddress(),
      amount: amount,
      deadline: deadline,
    };

    const signature = await signIntent(backendSigner, intent, await router.getAddress());

    await expect(
      router.connect(buyer).pay(intent, signature)
    ).to.be.revertedWithCustomError(router, "PaymentExpired");
  });

  it("4. Replaying paymentId: Revert with PaymentAlreadyExecuted", async function () {
    const paymentId = ethers.keccak256(ethers.toUtf8Bytes("order_1004"));
    const amount = ethers.parseUnits("15", 6);
    const latestBlock = await ethers.provider.getBlock("latest");
    const deadline = latestBlock.timestamp + 3600;

    const intent = {
      paymentId: paymentId,
      buyer: buyer.address,
      merchant: merchant.address,
      token: await usdc.getAddress(),
      amount: amount,
      deadline: deadline,
    };

    const signature = await signIntent(backendSigner, intent, await router.getAddress());

    // First call succeeds
    await router.connect(buyer).pay(intent, signature);

    // Second call with same paymentId must revert
    await expect(
      router.connect(buyer).pay(intent, signature)
    ).to.be.revertedWithCustomError(router, "PaymentAlreadyExecuted");
  });

  it("5. Caller is not buyer: Revert with InvalidBuyer", async function () {
    const paymentId = ethers.keccak256(ethers.toUtf8Bytes("order_1005"));
    const amount = ethers.parseUnits("30", 6);
    const latestBlock = await ethers.provider.getBlock("latest");
    const deadline = latestBlock.timestamp + 3600;

    const intent = {
      paymentId: paymentId,
      buyer: buyer.address,
      merchant: merchant.address,
      token: await usdc.getAddress(),
      amount: amount,
      deadline: deadline,
    };

    const signature = await signIntent(backendSigner, intent, await router.getAddress());

    // Attacker calls pay() instead of buyer
    await expect(
      router.connect(attacker).pay(intent, signature)
    ).to.be.revertedWithCustomError(router, "InvalidBuyer");
  });

  it("6. Insufficient allowance: Revert, no funds transferred and no event", async function () {
    // Reset buyer allowance to 0
    await usdc.connect(buyer).approve(await router.getAddress(), 0);

    const paymentId = ethers.keccak256(ethers.toUtf8Bytes("order_1006"));
    const amount = ethers.parseUnits("10", 6);
    const latestBlock = await ethers.provider.getBlock("latest");
    const deadline = latestBlock.timestamp + 3600;

    const intent = {
      paymentId: paymentId,
      buyer: buyer.address,
      merchant: merchant.address,
      token: await usdc.getAddress(),
      amount: amount,
      deadline: deadline,
    };

    const signature = await signIntent(backendSigner, intent, await router.getAddress());

    await expect(
      router.connect(buyer).pay(intent, signature)
    ).to.be.reverted;
  });

  it("7. Invalid token or merchant: Revert", async function () {
    const latestBlock = await ethers.provider.getBlock("latest");
    const deadline = latestBlock.timestamp + 3600;

    // A. Unsupported token
    const fakeToken = attacker.address;
    const intentUnsupportedToken = {
      paymentId: ethers.keccak256(ethers.toUtf8Bytes("order_1007a")),
      buyer: buyer.address,
      merchant: merchant.address,
      token: fakeToken,
      amount: ethers.parseUnits("10", 6),
      deadline: deadline,
    };
    const sigA = await signIntent(backendSigner, intentUnsupportedToken, await router.getAddress());
    await expect(
      router.connect(buyer).pay(intentUnsupportedToken, sigA)
    ).to.be.revertedWithCustomError(router, "UnsupportedToken");

    // B. Zero address merchant
    const intentZeroMerchant = {
      paymentId: ethers.keccak256(ethers.toUtf8Bytes("order_1007b")),
      buyer: buyer.address,
      merchant: ethers.ZeroAddress,
      token: await usdc.getAddress(),
      amount: ethers.parseUnits("10", 6),
      deadline: deadline,
    };
    const sigB = await signIntent(backendSigner, intentZeroMerchant, await router.getAddress());
    await expect(
      router.connect(buyer).pay(intentZeroMerchant, sigB)
    ).to.be.revertedWithCustomError(router, "InvalidMerchant");

    // C. Zero amount
    const intentZeroAmount = {
      paymentId: ethers.keccak256(ethers.toUtf8Bytes("order_1007c")),
      buyer: buyer.address,
      merchant: merchant.address,
      token: await usdc.getAddress(),
      amount: 0,
      deadline: deadline,
    };
    const sigC = await signIntent(backendSigner, intentZeroAmount, await router.getAddress());
    await expect(
      router.connect(buyer).pay(intentZeroAmount, sigC)
    ).to.be.revertedWithCustomError(router, "InvalidAmount");
  });

  it("8. Wrong chainId or Router in domain separator: Revert with InvalidSigner", async function () {
    const paymentId = ethers.keccak256(ethers.toUtf8Bytes("order_1008"));
    const amount = ethers.parseUnits("10", 6);
    const latestBlock = await ethers.provider.getBlock("latest");
    const deadline = latestBlock.timestamp + 3600;

    const intent = {
      paymentId: paymentId,
      buyer: buyer.address,
      merchant: merchant.address,
      token: await usdc.getAddress(),
      amount: amount,
      deadline: deadline,
    };

    // A. Wrong chainId (e.g. 1 instead of local chainId)
    const sigWrongChain = await signIntent(backendSigner, intent, await router.getAddress(), 1);
    await expect(
      router.connect(buyer).pay(intent, sigWrongChain)
    ).to.be.revertedWithCustomError(router, "InvalidSigner");

    // B. Wrong router address in domain
    const sigWrongRouter = await signIntent(backendSigner, intent, attacker.address, chainId);
    await expect(
      router.connect(buyer).pay(intent, sigWrongRouter)
    ).to.be.revertedWithCustomError(router, "InvalidSigner");
  });

  it("9. Admin management: Update backendSigner and token support", async function () {
    // Only owner can update signer
    await expect(
      router.connect(attacker).setBackendSigner(attacker.address)
    ).to.be.revertedWithCustomError(router, "OwnableUnauthorizedAccount");

    await expect(router.connect(owner).setBackendSigner(attacker.address))
      .to.emit(router, "BackendSignerUpdated")
      .withArgs(backendSigner.address, attacker.address);
    expect(await router.backendSigner()).to.equal(attacker.address);

    // Only owner can update token support
    const newToken = ethers.Wallet.createRandom().address;
    await expect(
      router.connect(attacker).setTokenSupport(newToken, true)
    ).to.be.revertedWithCustomError(router, "OwnableUnauthorizedAccount");

    await expect(router.connect(owner).setTokenSupport(newToken, true))
      .to.emit(router, "TokenSupportUpdated")
      .withArgs(newToken, true);
    expect(await router.allowedTokens(newToken)).to.be.true;
  });
});
