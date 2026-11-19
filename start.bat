@echo off
chcp 65001 >nul
cd /d "%~dp0"
title STELLAR ARCHIVE · 星屿藏馆

where node >nul 2>nul
if %errorlevel%==0 (
  start "" http://127.0.0.1:4173
  node server.mjs
  goto :eof
)

set "DSH_NODE=%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
if exist "%DSH_NODE%" (
  start "" http://127.0.0.1:4173
  "%DSH_NODE%" server.mjs
  goto :eof
)

echo.
echo 找不到 Node.js。请先安装 Node.js 18+，或直接让我启动预览服务。
echo.
pause
