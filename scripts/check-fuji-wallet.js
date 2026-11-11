const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  const FUJI_RPC = process.env.FUJI_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc";
  const provider = new ethers.JsonRpcProvider(FUJI_RPC);

  console.log("=== Avalanche Fuji C-Chain Network & Wallet Check ===");
  console.log(`RPC Endpoint: ${FUJI_RPC}`);

  try {
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    console.log(` Connected to Fuji! Chain ID: ${network.chainId}, Current Block: ${blockNumber}`);
  } catch (err) {
    console.error(" Failed to connect to Avalanche Fuji RPC:", err.message);
    return;
  }

  let privateKey = process.env.PRIVATE_KEY;
  if (!privateKey || privateKey.includes("0000000000000000000000000000000000000000")) {
    console.log("\n  Chưa có PRIVATE_KEY thực tế trong file .env!");
    console.log("Tạo ví ngẫu nhiên mới để bạn nạp faucet thử nghiệm:");
    const newWallet = ethers.Wallet.createRandom();
    console.log(`--------------------------------------------------`);
    console.log(`Địa chỉ ví (Address) : ${newWallet.address}`);
    console.log(`Private Key          : ${newWallet.privateKey}`);
    console.log(`--------------------------------------------------`);
    console.log(`Nhận testnet AVAX miễn phí tại:`);
    console.log(`-> https://core.app/tools/testnet-faucet/?subnet=c&token=c`);
    console.log(`Sau khi nhận AVAX, hãy thêm PRIVATE_KEY vào file .env và chạy: npm run deploy:fuji`);
    return;
  }

  const wallet = new ethers.Wallet(privateKey, provider);
  const balance = await provider.getBalance(wallet.address);
  console.log(`\nVí cấu hình trong .env: ${wallet.address}`);
  console.log(`Số dư AVAX trên Fuji  : ${ethers.formatEther(balance)} AVAX`);

  if (balance === 0n) {
    console.log(`  Số dư là 0 AVAX. Hãy nhận testnet AVAX tại:`);
    console.log(`-> https://core.app/tools/testnet-faucet/?subnet=c&token=c`);
  } else {
    console.log(` Sẵn sàng triển khai lên Fuji! Chạy: npm run deploy:fuji`);
  }
}

main().catch(console.error);
