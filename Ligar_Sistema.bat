@echo off
title Ligar Sistema Sao Jose
echo Iniciando o sistema em modo silencioso...
cd /d "e:\Projeto Sao Jose"
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
