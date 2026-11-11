// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @notice Test USDC ERC-20 token with 6 decimals for Universal Checkout on Avalanche Fuji.
 */
contract MockUSDC is ERC20 {
    uint8 private constant DECIMALS = 6;

    constructor() ERC20("USD Coin", "USDC") {
        // Mint initial supply to deployer (1,000,000 USDC)
        _mint(msg.sender, 1_000_000 * 10 ** DECIMALS);
    }

    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /**
     * @notice Faucet function to mint test USDC for testing.
     * @param to Recipient address.
     * @param amount Amount in 6-decimal units (e.g. 10 * 10**6 for 10 USDC).
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
