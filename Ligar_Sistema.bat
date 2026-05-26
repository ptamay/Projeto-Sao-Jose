@echo off
title Ligar Sistema Sao Jose
echo Iniciando o sistema em modo silencioso...
cd /d "%~dp0"
pm2 start ecosystem.config.js
echo.
echo ------------------------------------------
echo STATUS ATUAL:
pm2 list
echo ------------------------------------------
echo Sistema ligado! Pode fechar esta janela.
echo Acesse: http://localhost:3000
echo.
pause
