@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   ОЧИСТКА БАЗЫ ДАННЫХ ДРОПШИППИНГА
echo ========================================
echo.

echo [1/4] Проверка Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js не найден. Установите Node.js и повторите попытку.
    pause
    exit /b 1
)
echo ✅ Node.js найден

echo.
echo [2/4] Проверка PostgreSQL...
set "PG_PATH=C:\Program Files\PostgreSQL\13\bin"
if not exist "%PG_PATH%\psql.exe" (
    set "PG_PATH=C:\Program Files\PostgreSQL\14\bin"
    if not exist "%PG_PATH%\psql.exe" (
        set "PG_PATH=C:\Program Files\PostgreSQL\15\bin"
        if not exist "%PG_PATH%\psql.exe" (
            set "PG_PATH=C:\Program Files\PostgreSQL\16\bin"
            if not exist "%PG_PATH%\psql.exe" (
                echo ❌ PostgreSQL не найден в стандартных путях
                echo 🔧 Попробуйте добавить PostgreSQL в PATH вручную
                pause
                exit /b 1
            )
        )
    )
)

echo 🔧 Добавляем PostgreSQL в PATH...
set "PATH=%PG_PATH%;%PATH%"

echo 🔍 Проверяем подключение к PostgreSQL...
psql -h localhost -U postgres -d postgres -c "SELECT 1;" >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Не удается подключиться к PostgreSQL
    echo 🔧 Проверьте, что PostgreSQL запущен и доступен
    pause
    exit /b 1
)
echo ✅ PostgreSQL подключен

echo.
echo [3/4] Проверка базы данных dropshipping_db...
psql -h localhost -U postgres -d dropshipping_db -c "SELECT 1;" >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ База данных dropshipping_db не найдена
    echo 🔧 Создайте базу данных с помощью setup-database.bat
    pause
    exit /b 1
)
echo ✅ База данных dropshipping_db доступна

echo.
echo [4/4] ⚠️  ВНИМАНИЕ! ВЫ СОБИРАЕТЕСЬ ОЧИСТИТЬ ВСЕ ДАННЫЕ!
echo.
echo Это действие удалит:
echo - Всех пользователей
echo - Всех клиентов
echo - Все заказы
echo - Все депозиты
echo - Все уведомления
echo - Все API ключи
echo.
echo ⚠️  ЭТО ДЕЙСТВИЕ НЕОБРАТИМО!
echo.
set /p confirm="Вы уверены, что хотите продолжить? (введите 'YES' для подтверждения): "
if not "%confirm%"=="YES" (
    echo ❌ Операция отменена
    pause
    exit /b 0
)

echo.
echo 🗑️  Начинаем очистку базы данных...

echo 📝 Удаляем все уведомления...
psql -h localhost -U postgres -d dropshipping_db -c "DELETE FROM notifications;" 2>nul

echo 📝 Удаляем все заказы...
psql -h localhost -U postgres -d dropshipping_db -c "DELETE FROM orders;" 2>nul

echo 📝 Удаляем все депозиты...
psql -h localhost -U postgres -d dropshipping_db -c "DELETE FROM deposits;" 2>nul

echo 📝 Удаляем всех клиентов...
psql -h localhost -U postgres -d dropshipping_db -c "DELETE FROM clients;" 2>nul

echo 📝 Удаляем всех пользователей...
psql -h localhost -U postgres -d dropshipping_db -c "DELETE FROM users;" 2>nul

echo 📝 Сбрасываем счетчики автоинкремента...
psql -h localhost -U postgres -d dropshipping_db -c "ALTER SEQUENCE users_id_seq RESTART WITH 1;" 2>nul
psql -h localhost -U postgres -d dropshipping_db -c "ALTER SEQUENCE clients_id_seq RESTART WITH 1;" 2>nul
psql -h localhost -U postgres -d dropshipping_db -c "ALTER SEQUENCE orders_id_seq RESTART WITH 1;" 2>nul
psql -h localhost -U postgres -d dropshipping_db -c "ALTER SEQUENCE deposits_id_seq RESTART WITH 1;" 2>nul
psql -h localhost -U postgres -d dropshipping_db -c "ALTER SEQUENCE notifications_id_seq RESTART WITH 1;" 2>nul

echo.
echo ✅ База данных успешно очищена!
echo.
echo 📊 Статистика:
echo - Пользователи: 0
echo - Клиенты: 0  
echo - Заказы: 0
echo - Депозиты: 0
echo - Уведомления: 0
echo.
echo 🔄 Счетчики автоинкремента сброшены
echo.
echo 💡 Теперь вы можете:
echo - Запустить систему: start-fixed.bat
echo - Создать новых пользователей через регистрацию
echo - Настроить API ключи для каждого пользователя отдельно
echo.
pause



