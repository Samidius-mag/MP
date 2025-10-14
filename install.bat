@echo off
chcp 65001 >nul
title Установка системы автоматизации дропшиппинга

echo.
echo ========================================
echo   УСТАНОВКА СИСТЕМЫ ДРОПШИППИНГА
echo ========================================
echo.

echo [1/4] Проверка Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js не найден! Установите Node.js 18+ с https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js найден: %NODE_VERSION%

echo.
echo [2/4] Проверка PostgreSQL...
set "PGPASSWORD=postgres"
psql -U postgres -c "SELECT version();" >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ PostgreSQL не найден! Установите PostgreSQL 13+ с https://www.postgresql.org/
    echo 💡 Или используйте Docker: docker run --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:13
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('psql -U postgres -c "SELECT version();" 2^>nul') do set PG_VERSION=%%i
echo ✅ PostgreSQL найден

echo.
echo [3/4] Установка зависимостей...
echo 📦 Устанавливаем корневые зависимости...
call npm install
if %errorlevel% neq 0 (
    echo ❌ Ошибка установки корневых зависимостей
    pause
    exit /b 1
)

echo 📦 Устанавливаем зависимости сервера...
cd server
call npm install
if %errorlevel% neq 0 (
    echo ❌ Ошибка установки зависимостей сервера
    pause
    exit /b 1
)
cd ..

echo 📦 Устанавливаем зависимости клиента...
cd client
call npm install
if %errorlevel% neq 0 (
    echo ❌ Ошибка установки зависимостей клиента
    pause
    exit /b 1
)
cd ..

echo.
echo [4/4] Настройка конфигурации...
if not exist "server\.env" (
    copy "server\env.example" "server\.env" >nul
    echo ✅ Создан файл server\.env
) else (
    echo ✅ Файл server\.env уже существует
)

echo.
echo 🎉 Установка завершена!
echo.
echo 📋 Следующие шаги:
echo 1. Настройте переменные в server\.env
echo 2. Запустите setup-database.bat для создания базы данных
echo 3. Запустите start.bat для запуска системы
echo.
pause





