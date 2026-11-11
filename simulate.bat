@echo off
title Universal Checkout - E2E Simulation
cd /d "%~dp0"
echo ========================================================
echo Running Universal Checkout E2E Flow Simulation...
echo ========================================================
call npx hardhat run scripts/simulate-e2e.js
echo.
pause
