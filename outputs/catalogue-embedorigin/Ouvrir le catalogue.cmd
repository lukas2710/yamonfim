@echo off
cd /d "%~dp0"
start "" /b powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process -FilePath 'Catalogue EmbedOrigin.html'"
node server.cjs
pause
