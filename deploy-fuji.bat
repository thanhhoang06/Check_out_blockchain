@echo off
title Universal Checkout - Deploy to Avalanche Fuji
cd /d "%~dp0"
echo ========================================================
echo Checking Fuji Wallet & Deploying Payment Router...
echo ========================================================
call node scripts/check-fuji-wallet.js
echo.
echo Deploying to Fuji C-Chain...
call npx hardhat run scripts/deploy.js --network fuji
echo.
pause
