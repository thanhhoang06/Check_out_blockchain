@echo off
title Universal Checkout - Acceptance Tests
cd /d "%~dp0"
echo ========================================================
echo Running Acceptance Test Suite (9 Test Cases)...
echo ========================================================
call npx hardhat test
echo.
pause
