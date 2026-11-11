# Universal Checkout — Smart Contract (Work Package 04)
### Avalanche Fuji C-Chain (Chain ID: 43113) · Non-custodial USDC Payment Infrastructure

Hợp đồng thông minh **PaymentRouter** chịu trách nhiệm điều phối việc thanh toán USDC trực tiếp từ ví người mua (Buyer) đến ví người bán (Merchant), đảm bảo tính toàn vẹn của giao dịch thông qua chữ ký chuẩn EIP-712 do Backend phát hành và hoàn toàn **không lưu giữ tiền** (Non-custodial).

---

## 1. Thông số Kỹ thuật & Mạng Avalanche Fuji

| Hạng mục | Giá trị |
| :--- | :--- |
| **Blockchain** | Avalanche Fuji C-Chain (Testnet) |
| **Chain ID** | `43113` (`0xa869`) |
| **RPC Endpoint** | `https://api.avax-test.network/ext/bc/C/rpc` |
| **PaymentRouter Deployed** | [`0xC83FA9cEcf7fc125dbeC893402c6f0f5e3f5AeE9`](https://testnet.snowtrace.io/address/0xC83FA9cEcf7fc125dbeC893402c6f0f5e3f5AeE9) |
| **MockUSDC (Free Faucet)** | [`0xA61ABC464034161B4C5abAee7298c1503cF6E199`](https://testnet.snowtrace.io/address/0xA61ABC464034161B4C5abAee7298c1503cF6E199) |
| **Official Circle USDC (Fuji)** | `0x5425890298aed601595a70AB815c96711a31Bc65` (Decimals: 6) |
| **Giao dịch Deploy Router** | [Tx: 0x9426af19...](https://testnet.snowtrace.io/tx/0x9426af195a55f060e8888691efd3c071b212aab79068a2a0b908f48561ddcc0a) |
| **Giao dịch Thanh toán Thật** | [Tx: 0x2b1d73f7...](https://testnet.snowtrace.io/tx/0x2b1d73f7e9c70fe1a05ce531cd8b196bc50ac256357b160b77493188ae2932ab) |

---

## 2. Đặc tả Hợp đồng `PaymentRouter.sol`

### 2.1 Cấu trúc Dữ liệu `PaymentIntent`
```solidity
struct PaymentIntent {
    bytes32 paymentId;  // Khóa định danh phiên thanh toán (Hash của draft order)
    address buyer;      // Địa chỉ ví người mua (msg.sender)
    address merchant;   // Địa chỉ ví người bán nhận USDC
    address token;      // Địa chỉ token USDC
    uint256 amount;     // Số lượng USDC tính theo đơn vị nhỏ nhất (6 decimals)
    uint256 deadline;   // Unix timestamp hết hạn của phiên checkout
}
```

### 2.2 EIP-712 Domain Separator & TypeHash
```solidity
// Domain:
{
    name: "UniversalCheckout",
    version: "1",
    chainId: 43113,
    verifyingContract: <routerAddress>
}

// TypeHash:
keccak256("PaymentIntent(bytes32 paymentId,address buyer,address merchant,address token,uint256 amount,uint256 deadline)")
```

### 2.3 Hàm Thanh toán Chính
```solidity
function pay(
    PaymentIntent calldata intent,
    bytes calldata signature
) external nonReentrant;
```

### 2.4 Sự kiện `PaymentReceived`
Phát ra ngay sau khi chuyển USDC thành công để Backend Worker xác minh và đối chiếu receipt:
```solidity
event PaymentReceived(
    bytes32 indexed paymentId,
    address indexed buyer,
    address indexed merchant,
    address token,
    uint256 amount
);
```

---

## 3. Các Quy tắc Bảo mật & Checks-Effects-Interactions

1. **Xác thực Signer**: Chỉ chấp nhận chữ ký EIP-712 khôi phục đúng từ `backendSigner`. Revert với `InvalidSigner`.
2. **Khớp Buyer**: `msg.sender == intent.buyer`. Revert với `InvalidBuyer`.
3. **Whitelist Token**: Token phải nằm trong whitelist (`allowedTokens[intent.token] == true`). Revert với `UnsupportedToken`.
4. **Kiểm tra Địa chỉ & Số tiền**: `intent.merchant != address(0)` và `intent.amount > 0`.
5. **Thời hạn (Deadline)**: `block.timestamp <= intent.deadline`. Revert với `PaymentExpired`.
6. **Chống Replay (paymentId)**: Đánh dấu `executedPayments[intent.paymentId] = true` **trước** khi thực hiện gọi external token transfer (`SafeERC20.safeTransferFrom`).
7. **Direct Transfer**: USDC chuyển thẳng từ Buyer $\rightarrow$ Merchant. Hợp đồng Router và Backend không giữ token ở bất kỳ thời điểm nào.

---

## 4. Kết quả Kiểm thử Nghiệm thu (Acceptance Tests)

Bộ test bao phủ 100% các yêu cầu trong bảng nghiệm thu của Work Package 04:

```text
  PaymentRouter Acceptance Tests
    ✔ 1. Valid payment: Merchant receives exact USDC and PaymentReceived event emitted
    ✔ 2. Tampered signature or wrong signer: Revert with InvalidSigner
    ✔ 3. Expired PaymentIntent: Revert with PaymentExpired
    ✔ 4. Replaying paymentId: Revert with PaymentAlreadyExecuted
    ✔ 5. Caller is not buyer: Revert with InvalidBuyer
    ✔ 6. Insufficient allowance: Revert, no funds transferred and no event
    ✔ 7. Invalid token or merchant: Revert
    ✔ 8. Wrong chainId or Router in domain separator: Revert with InvalidSigner
    ✔ 9. Admin management: Update backendSigner and token support

  9 passing (5s)
```

---

## 5. Hướng dẫn Chạy & Triển khai

### Cài đặt môi trường
Tạo file `.env` từ `.env.example`:
```bash
cp .env.example .env
```
Điền `PRIVATE_KEY` (ví có test AVAX trên Fuji) và `BACKEND_SIGNER_ADDRESS`.

### Chạy kiểm thử:
```bash
npm test
```

### Chạy ví dụ tạo chữ ký EIP-712:
```bash
npm run example:sign
```

### Triển khai lên Avalanche Fuji Testnet:
```bash
npm run deploy:fuji
```
Sau khi deploy thành công, script sẽ tự động tạo file `deployments/deployment-43113.json` chứa:
- Địa chỉ `PaymentRouter`
- Địa chỉ `USDC`
- Tx Hash & Link Snowtrace
- Toàn bộ `ABI` chuẩn để bàn giao cho Backend & Frontend.

---

## 6. Ranh giới Tích hợp & Dữ liệu Bàn giao

### Cho Backend Developer:
- **Tạo & Ký Intent**: Sử dụng cấu trúc và Domain Separator ở mục 2 để ký EIP-712 bằng server private key.
- **Xác minh Giao dịch (Worker)**:
  - Lắng nghe sự kiện `PaymentReceived` hoặc đọc `receipt.logs` từ `tx_hash`.
  - Đối chiếu `paymentId`, `buyer`, `merchant`, `token`, `amount` với `payment_sessions` trong Database.
  - Khi khớp, gọi Shopify GraphQL `draftOrderComplete`.

### Cho Frontend Developer (Hosted Checkout):
- **Bước 1**: Kết nối ví (Avalanche Fuji - Chain ID 43113).
- **Bước 2 (Approve)**: Kiểm tra `allowance(buyer, routerAddress) >= intent.amount`. Nếu chưa, gọi `USDC.approve(routerAddress, intent.amount)`.
- **Bước 3 (Pay)**: Gọi `PaymentRouter.pay(intent, signature)`.
- **File ABI**: Lấy tại `deployments/PaymentRouter_ABI.json`.
