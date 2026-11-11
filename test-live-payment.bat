@echo off
title Universal Checkout - Live Payment on Avalanche Fuji
cd /d "%~dp0"
echo ========================================================
echo Gui giao dich thanh toan USDC that len Avalanche Fuji...
echo ========================================================
call npx hardhat run scripts/test-live-payment-fuji.js --network fuji
echo.
pause
