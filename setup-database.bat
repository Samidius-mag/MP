@echo off
chcp 65001 >nul
title Настройка базы данных PostgreSQL

echo.
echo ========================================
echo   НАСТРОЙКА БАЗЫ ДАННЫХ POSTGRESQL
echo ========================================
echo.

set "PGPASSWORD=postgres"
set "DB_HOST=localhost"
set "DB_PORT=5432"
set "DB_NAME=dropshipping_db"
set "DB_USER=postgres"

echo [1/3] Проверка подключения к PostgreSQL...
psql -U %DB_USER% -c "SELECT version();" >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Не удалось подключиться к PostgreSQL
    echo 💡 Убедитесь, что PostgreSQL запущен и доступен
    echo 💡 Проверьте, что пользователь postgres существует
    pause
    exit /b 1
)
echo ✅ Подключение к PostgreSQL успешно

echo.
echo [2/3] Проверка существования базы данных...
psql -U %DB_USER% -d %DB_NAME% -c "SELECT 1;" >nul 2>&1
if %errorlevel% neq 0 (
    echo 📦 Создание базы данных %DB_NAME%...
    psql -U %DB_USER% -c "CREATE DATABASE %DB_NAME%;" >nul 2>&1
    if %errorlevel% neq 0 (
        echo ❌ Ошибка создания базы данных
        echo 💡 Попробуйте создать базу данных вручную:
        echo    psql -U postgres -c "CREATE DATABASE %DB_NAME%;"
        pause
        exit /b 1
    )
    echo ✅ База данных %DB_NAME% создана успешно
) else (
    echo ✅ База данных %DB_NAME% уже существует
)

echo.
echo [3/3] Проверка таблиц...
psql -U %DB_USER% -d %DB_NAME% -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';" >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Ошибка проверки таблиц
    pause
    exit /b 1
)

echo ✅ База данных готова к использованию
echo.
echo 📋 Информация о подключении:
echo    Хост: %DB_HOST%
echo    Порт: %DB_PORT%
echo    База данных: %DB_NAME%
echo    Пользователь: %DB_USER%
echo.
echo 💡 Таблицы будут созданы автоматически при первом запуске сервера
echo.
echo 🎉 Настройка базы данных завершена!
echo.
pause



