@echo off
title Universal Checkout Web Demo
cd /d "%~dp0"
echo ========================================================
echo Starting Universal Checkout Web Interface...
echo URL: http://localhost:3000
echo ========================================================
node web/server.js
pause
