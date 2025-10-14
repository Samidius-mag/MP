@echo off
chcp 65001 >nul
title Клиент системы автоматизации дропшиппинга

echo.
echo ========================================
echo   ЗАПУСК КЛИЕНТА ДРОПШИППИНГА
echo ========================================
echo.

echo [1/1] Запуск клиента...
echo.
echo 🌐 Запускаем клиент...
echo 🌐 Клиент будет доступен на: http://localhost:3000
echo.
echo Для остановки нажмите Ctrl+C
echo.

cd client
npm run dev

echo.
echo Клиент остановлен.
pause





