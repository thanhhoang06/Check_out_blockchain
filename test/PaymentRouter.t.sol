// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PaymentRouter} from "../contracts/PaymentRouter.sol";
import {MockUSDC} from "../contracts/MockUSDC.sol";

contract PaymentRouterTest is Test {
    PaymentRouter public router;
    MockUSDC public usdc;

    uint256 internal backendSignerPrivateKey = 0xA11CE;
    address internal backendSigner;

    uint256 internal buyerPrivateKey = 0xB0B;
    address internal buyer;

    address internal merchant = address(0x1337);
    address internal owner = address(this);

    bytes32 internal constant PAYMENT_INTENT_TYPEHASH = keccak256(
        "PaymentIntent(bytes32 paymentId,address buyer,address merchant,address token,uint256 amount,uint256 deadline)"
    );

    function setUp() public {
        backendSigner = vm.addr(backendSignerPrivateKey);
        buyer = vm.addr(buyerPrivateKey);

        usdc = new MockUSDC();
        router = new PaymentRouter(backendSigner, owner, address(usdc));

        // Fund buyer with 1,000 USDC
        usdc.mint(buyer, 1_000 * 10 ** 6);

        // Buyer approves router
        vm.prank(buyer);
        usdc.approve(address(router), type(uint256).max);
    }

    function _signPaymentIntent(
        PaymentRouter.PaymentIntent memory intent,
        uint256 signerKey,
        address contractAddress,
        uint256 chainId
    ) internal view returns (bytes memory) {
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("UniversalCheckout")),
                keccak256(bytes("1")),
                chainId,
                contractAddress
            )
        );

        bytes32 structHash = keccak256(
            abi.encode(
                PAYMENT_INTENT_TYPEHASH,
                intent.paymentId,
                intent.buyer,
                intent.merchant,
                intent.token,
                intent.amount,
                intent.deadline
            )
        );

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function test_ValidPayment() public {
        bytes32 paymentId = keccak256("order_001");
        uint256 amount = 50 * 10 ** 6; // 50 USDC
        uint256 deadline = block.timestamp + 1 hours;

        PaymentRouter.PaymentIntent memory intent = PaymentRouter.PaymentIntent({
            paymentId: paymentId,
            buyer: buyer,
            merchant: merchant,
            token: address(usdc),
            amount: amount,
            deadline: deadline
        });

        bytes memory sig = _signPaymentIntent(intent, backendSignerPrivateKey, address(router), block.chainid);

        uint256 merchantBalBefore = usdc.balanceOf(merchant);
        uint256 buyerBalBefore = usdc.balanceOf(buyer);

        vm.expectEmit(true, true, true, true);
        emit PaymentRouter.PaymentReceived(paymentId, buyer, merchant, address(usdc), amount);

        vm.prank(buyer);
        router.pay(intent, sig);

        assertEq(usdc.balanceOf(merchant), merchantBalBefore + amount);
        assertEq(usdc.balanceOf(buyer), buyerBalBefore - amount);
        assertTrue(router.executedPayments(paymentId));
    }

    function test_RevertIf_CallerNotBuyer() public {
        bytes32 paymentId = keccak256("order_002");
        PaymentRouter.PaymentIntent memory intent = PaymentRouter.PaymentIntent({
            paymentId: paymentId,
            buyer: buyer,
            merchant: merchant,
            token: address(usdc),
            amount: 10 * 10 ** 6,
            deadline: block.timestamp + 1 hours
        });

        bytes memory sig = _signPaymentIntent(intent, backendSignerPrivateKey, address(router), block.chainid);

        address attacker = address(0xdead);
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(PaymentRouter.InvalidBuyer.selector, buyer, attacker));
        router.pay(intent, sig);
    }

    function test_RevertIf_InvalidSigner() public {
        bytes32 paymentId = keccak256("order_003");
        PaymentRouter.PaymentIntent memory intent = PaymentRouter.PaymentIntent({
            paymentId: paymentId,
            buyer: buyer,
            merchant: merchant,
            token: address(usdc),
            amount: 10 * 10 ** 6,
            deadline: block.timestamp + 1 hours
        });

        uint256 fakeSignerKey = 0xBAD;
        bytes memory sig = _signPaymentIntent(intent, fakeSignerKey, address(router), block.chainid);

        vm.prank(buyer);
        vm.expectRevert();
        router.pay(intent, sig);
    }

    function test_RevertIf_Expired() public {
        bytes32 paymentId = keccak256("order_004");
        uint256 deadline = block.timestamp + 10 minutes;

        PaymentRouter.PaymentIntent memory intent = PaymentRouter.PaymentIntent({
            paymentId: paymentId,
            buyer: buyer,
            merchant: merchant,
            token: address(usdc),
            amount: 10 * 10 ** 6,
            deadline: deadline
        });

        bytes memory sig = _signPaymentIntent(intent, backendSignerPrivateKey, address(router), block.chainid);

        // Fast forward time past deadline
        vm.warp(deadline + 1 seconds);

        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(PaymentRouter.PaymentExpired.selector, deadline, deadline + 1 seconds));
        router.pay(intent, sig);
    }

    function test_RevertIf_ReplayPaymentId() public {
        bytes32 paymentId = keccak256("order_005");
        PaymentRouter.PaymentIntent memory intent = PaymentRouter.PaymentIntent({
            paymentId: paymentId,
            buyer: buyer,
            merchant: merchant,
            token: address(usdc),
            amount: 10 * 10 ** 6,
            deadline: block.timestamp + 1 hours
        });

        bytes memory sig = _signPaymentIntent(intent, backendSignerPrivateKey, address(router), block.chainid);

        vm.prank(buyer);
        router.pay(intent, sig);

        // Try replay
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(PaymentRouter.PaymentAlreadyExecuted.selector, paymentId));
        router.pay(intent, sig);
    }

    function test_RevertIf_WrongChainId() public {
        bytes32 paymentId = keccak256("order_006");
        PaymentRouter.PaymentIntent memory intent = PaymentRouter.PaymentIntent({
            paymentId: paymentId,
            buyer: buyer,
            merchant: merchant,
            token: address(usdc),
            amount: 10 * 10 ** 6,
            deadline: block.timestamp + 1 hours
        });

        // Signed with chainId = 1 instead of block.chainid
        bytes memory sig = _signPaymentIntent(intent, backendSignerPrivateKey, address(router), 1);

        vm.prank(buyer);
        vm.expectRevert();
        router.pay(intent, sig);
    }
}
