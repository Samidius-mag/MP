@echo off
chcp 65001 >nul
title Сервер системы автоматизации дропшиппинга

echo.
echo ========================================
echo   ЗАПУСК СЕРВЕРА ДРОПШИППИНГА
echo ========================================
echo.

echo [1/2] Проверка PostgreSQL...
set "PGPASSWORD=postgres"
psql -U postgres -d dropshipping_db -c "SELECT 1;" >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ PostgreSQL не доступен! Убедитесь, что PostgreSQL запущен.
    echo 💡 Запустите PostgreSQL или выполните setup-database.bat
    pause
    exit /b 1
)
echo ✅ PostgreSQL подключен

echo.
echo [2/2] Запуск сервера...
echo.
echo 🚀 Запускаем сервер...
echo 📊 Сервер будет доступен на: http://localhost:3001
echo 🔍 Health check: http://localhost:3001/api/health
echo.
echo Для остановки нажмите Ctrl+C
echo.

cd server
node index.js

echo.
echo Сервер остановлен.
pause


