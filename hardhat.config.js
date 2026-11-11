require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const FUJI_RPC_URL = process.env.FUJI_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    fuji: {
      url: FUJI_RPC_URL,
      chainId: 43113,
      accounts: PRIVATE_KEY.startsWith("0x") ? [PRIVATE_KEY] : [`0x${PRIVATE_KEY}`],
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
