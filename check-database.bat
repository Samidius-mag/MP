@echo off
chcp 65001 >nul
title Диагностика базы данных PostgreSQL

echo.
echo ========================================
echo   ДИАГНОСТИКА БАЗЫ ДАННЫХ POSTGRESQL
echo ========================================
echo.

set "PGPASSWORD=postgres"

echo [1/5] Проверка PostgreSQL...
echo 🔧 Добавляем PostgreSQL в PATH...
set "PATH=%PATH%;C:\Program Files\PostgreSQL\13\bin"
if not exist "C:\Program Files\PostgreSQL\13\bin\psql.exe" (
    set "PATH=%PATH%;C:\Program Files\PostgreSQL\14\bin"
)
if not exist "C:\Program Files\PostgreSQL\14\bin\psql.exe" (
    set "PATH=%PATH%;C:\Program Files\PostgreSQL\15\bin"
)

psql --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ PostgreSQL не найден в PATH
    echo 💡 Добавьте PostgreSQL в переменную PATH:
    echo    C:\Program Files\PostgreSQL\13\bin
    echo.
    echo 🔧 Попытка найти PostgreSQL...
    if exist "C:\Program Files\PostgreSQL\13\bin\psql.exe" (
        echo ✅ PostgreSQL найден в C:\Program Files\PostgreSQL\13\bin\
        set "PGPATH=C:\Program Files\PostgreSQL\13\bin\"
    ) else if exist "C:\Program Files\PostgreSQL\14\bin\psql.exe" (
        echo ✅ PostgreSQL найден в C:\Program Files\PostgreSQL\14\bin\
        set "PGPATH=C:\Program Files\PostgreSQL\14\bin\"
    ) else if exist "C:\Program Files\PostgreSQL\15\bin\psql.exe" (
        echo ✅ PostgreSQL найден в C:\Program Files\PostgreSQL\15\bin\
        set "PGPATH=C:\Program Files\PostgreSQL\15\bin\"
    ) else (
        echo ❌ PostgreSQL не найден в стандартных папках
        echo 💡 Установите PostgreSQL с https://www.postgresql.org/
        pause
        exit /b 1
    )
) else (
    echo ✅ PostgreSQL найден в PATH
    set "PGPATH="
)

echo.
echo [2/5] Проверка подключения к PostgreSQL...
if defined PGPATH (
    "%PGPATH%psql" -U postgres -c "SELECT version();" >nul 2>&1
) else (
    psql -U postgres -c "SELECT version();" >nul 2>&1
)
if %errorlevel% neq 0 (
    echo ❌ Не удалось подключиться к PostgreSQL
    echo.
    echo 💡 Возможные причины:
    echo    1. PostgreSQL не запущен
    echo    2. Неправильный пароль (должен быть: postgres)
    echo    3. PostgreSQL работает на другом порту
    echo    4. Пользователь postgres не существует
    echo.
    echo 🔧 Попытка запуска PostgreSQL...
    net start postgresql-x64-13 >nul 2>&1
    if %errorlevel% neq 0 (
        net start postgresql-x64-14 >nul 2>&1
    )
    if %errorlevel% neq 0 (
        net start postgresql-x64-15 >nul 2>&1
    )
    if %errorlevel% neq 0 (
        echo ❌ Не удалось запустить PostgreSQL автоматически
        echo 💡 Запустите PostgreSQL вручную через службы Windows
    ) else (
        echo ✅ PostgreSQL запущен
        Start-Sleep -Seconds 3
    )
) else (
    echo ✅ Подключение к PostgreSQL успешно
)

echo.
echo [3/5] Проверка базы данных dropshipping_db...
if defined PGPATH (
    "%PGPATH%psql" -U postgres -d dropshipping_db -c "SELECT 1;" >nul 2>&1
) else (
    psql -U postgres -d dropshipping_db -c "SELECT 1;" >nul 2>&1
)
if %errorlevel% neq 0 (
    echo ❌ База данных dropshipping_db не найдена
    echo.
    echo 🔧 Создание базы данных...
    if defined PGPATH (
        "%PGPATH%psql" -U postgres -c "CREATE DATABASE dropshipping_db;"
    ) else (
        psql -U postgres -c "CREATE DATABASE dropshipping_db;"
    )
    if %errorlevel% neq 0 (
        echo ❌ Не удалось создать базу данных
        echo 💡 Проверьте права пользователя postgres
    ) else (
        echo ✅ База данных dropshipping_db создана
    )
) else (
    echo ✅ База данных dropshipping_db доступна
)

echo.
echo [4/5] Проверка таблиц...
if defined PGPATH (
    "%PGPATH%psql" -U postgres -d dropshipping_db -c "\dt" >nul 2>&1
) else (
    psql -U postgres -d dropshipping_db -c "\dt" >nul 2>&1
)
if %errorlevel% neq 0 (
    echo ❌ Ошибка проверки таблиц
) else (
    echo ✅ Таблицы доступны
)

echo.
echo [5/5] Проверка конфигурации сервера...
if exist "server\.env" (
    echo ✅ Файл конфигурации server\.env найден
    echo 📋 Содержимое конфигурации:
    type server\.env
) else (
    echo ❌ Файл server\.env не найден
    echo 💡 Скопируйте server\env.example в server\.env
)

echo.
echo ========================================
echo   РЕЗУЛЬТАТЫ ДИАГНОСТИКИ
echo ========================================
echo.

if defined PGPATH (
    "%PGPATH%psql" -U postgres -d dropshipping_db -c "SELECT 1;" >nul 2>&1
) else (
    psql -U postgres -d dropshipping_db -c "SELECT 1;" >nul 2>&1
)

if %errorlevel% equ 0 (
    echo ✅ База данных готова к работе!
    echo.
    echo 🚀 Теперь можно запустить start.bat
) else (
    echo ❌ База данных не готова
    echo.
    echo 🔧 Выполните следующие действия:
    echo    1. Убедитесь, что PostgreSQL запущен
    echo    2. Проверьте настройки в server\.env
    echo    3. Выполните setup-database.bat
)

echo.
pause

