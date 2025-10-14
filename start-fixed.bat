@echo off
chcp 65001 >nul
title Система автоматизации дропшиппинга

echo.
echo ========================================
echo   СИСТЕМА АВТОМАТИЗАЦИИ ДРОПШИППИНГА
echo ========================================
echo.

echo [1/3] Проверка Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js не найден! Установите Node.js 18+ с https://nodejs.org/
    pause
    exit /b 1
)
echo ✅ Node.js найден

echo.
echo [2/3] Проверка PostgreSQL...
set "PGPASSWORD=postgres"

echo 🔧 Добавляем PostgreSQL в PATH...
set "PATH=%PATH%;C:\Program Files\PostgreSQL\13\bin"
if not exist "C:\Program Files\PostgreSQL\13\bin\psql.exe" (
    set "PATH=%PATH%;C:\Program Files\PostgreSQL\14\bin"
)
if not exist "C:\Program Files\PostgreSQL\14\bin\psql.exe" (
    set "PATH=%PATH%;C:\Program Files\PostgreSQL\15\bin"
)

echo 🔍 Проверяем подключение к базе данных...
psql -U postgres -d dropshipping_db -c "SELECT 1;" >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ База данных dropshipping_db не найдена!
    echo.
    echo 🔧 Попытка создания базы данных...
    psql -U postgres -c "CREATE DATABASE dropshipping_db;" >nul 2>&1
    if %errorlevel% neq 0 (
        echo ❌ Не удалось создать базу данных!
        echo.
        echo 💡 Возможные решения:
        echo    1. Убедитесь, что PostgreSQL запущен
        echo    2. Проверьте права пользователя postgres
        echo    3. Выполните setup-database.bat
        echo    4. Проверьте настройки в server\.env
        echo.
        pause
        exit /b 1
    ) else (
        echo ✅ База данных dropshipping_db создана успешно
    )
) else (
    echo ✅ База данных dropshipping_db доступна
)

echo 🔍 Проверяем подключение к PostgreSQL...
psql -U postgres -c "SELECT version();" >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ PostgreSQL не доступен! Убедитесь, что PostgreSQL запущен.
    echo 💡 Запустите PostgreSQL или выполните setup-database.bat
    pause
    exit /b 1
)
echo ✅ PostgreSQL подключен

echo.
echo [3/3] Запуск системы...
echo.
echo 🚀 Запускаем сервер и клиент...
echo 📊 Сервер будет доступен на: http://localhost:3001
echo 🌐 Клиент будет доступен на: http://localhost:3000
echo.
echo Для остановки нажмите Ctrl+C
echo.

npm run dev

echo.
echo Система остановлена.
pause


