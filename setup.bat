@echo off
chcp 65001 >nul
title Полная настройка системы автоматизации дропшиппинга

echo.
echo ========================================
echo   ПОЛНАЯ НАСТРОЙКА СИСТЕМЫ
echo ========================================
echo.

echo Этот скрипт выполнит полную настройку системы:
echo 1. Установка зависимостей
echo 2. Настройка базы данных
echo 3. Создание конфигурационных файлов
echo.
echo Продолжить? (Y/N)
set /p choice=
if /i "%choice%" neq "Y" (
    echo Отмена настройки.
    pause
    exit /b 0
)

echo.
echo ========================================
echo   ЭТАП 1: УСТАНОВКА ЗАВИСИМОСТЕЙ
echo ========================================
call install.bat
if %errorlevel% neq 0 (
    echo ❌ Ошибка установки зависимостей
    pause
    exit /b 1
)

echo.
echo ========================================
echo   ЭТАП 2: НАСТРОЙКА БАЗЫ ДАННЫХ
echo ========================================
call setup-database.bat
if %errorlevel% neq 0 (
    echo ❌ Ошибка настройки базы данных
    pause
    exit /b 1
)

echo.
echo ========================================
echo   ЭТАП 3: ФИНАЛЬНАЯ ПРОВЕРКА
echo ========================================
echo.
echo Проверяем готовность системы...

echo [1/3] Проверка Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js не найден
    pause
    exit /b 1
)
echo ✅ Node.js готов

echo [2/3] Проверка PostgreSQL...
set "PGPASSWORD=postgres"
psql -U postgres -d dropshipping_db -c "SELECT 1;" >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ PostgreSQL не доступен
    pause
    exit /b 1
)
echo ✅ PostgreSQL готов

echo [3/3] Проверка зависимостей...
if not exist "node_modules" (
    echo ❌ Зависимости не установлены
    pause
    exit /b 1
)
if not exist "server\node_modules" (
    echo ❌ Зависимости сервера не установлены
    pause
    exit /b 1
)
if not exist "client\node_modules" (
    echo ❌ Зависимости клиента не установлены
    pause
    exit /b 1
)
echo ✅ Зависимости готовы

echo.
echo ========================================
echo   НАСТРОЙКА ЗАВЕРШЕНА!
echo ========================================
echo.
echo 🎉 Система полностью готова к использованию!
echo.
echo 📋 Доступные команды:
echo   start.bat          - Запуск всей системы
echo   start-server.bat   - Запуск только сервера
echo   start-client.bat   - Запуск только клиента
echo   stop.bat           - Остановка системы
echo.
echo 🌐 После запуска система будет доступна:
echo   Клиент: http://localhost:3000
echo   API:    http://localhost:3001
echo.
echo Запустить систему сейчас? (Y/N)
set /p choice=
if /i "%choice%"=="Y" (
    echo.
    echo Запускаем систему...
    call start.bat
) else (
    echo.
    echo Настройка завершена. Для запуска выполните start.bat
    pause
)


