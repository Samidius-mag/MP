# Очистка базы данных дропшиппинга
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   ОЧИСТКА БАЗЫ ДАННЫХ ДРОПШИППИНГА" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Проверка Node.js
Write-Host "[1/4] Проверка Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Node.js найден: $nodeVersion" -ForegroundColor Green
    } else {
        throw "Node.js не найден"
    }
} catch {
    Write-Host "❌ Node.js не найден. Установите Node.js и повторите попытку." -ForegroundColor Red
    Read-Host "Нажмите Enter для выхода"
    exit 1
}

# Проверка PostgreSQL
Write-Host ""
Write-Host "[2/4] Проверка PostgreSQL..." -ForegroundColor Yellow

# Поиск PostgreSQL в стандартных путях
$pgPaths = @(
    "C:\Program Files\PostgreSQL\13\bin",
    "C:\Program Files\PostgreSQL\14\bin", 
    "C:\Program Files\PostgreSQL\15\bin",
    "C:\Program Files\PostgreSQL\16\bin"
)

$pgPath = $null
foreach ($path in $pgPaths) {
    if (Test-Path "$path\psql.exe") {
        $pgPath = $path
        break
    }
}

if (-not $pgPath) {
    Write-Host "❌ PostgreSQL не найден в стандартных путях" -ForegroundColor Red
    Write-Host "🔧 Попробуйте добавить PostgreSQL в PATH вручную" -ForegroundColor Yellow
    Read-Host "Нажмите Enter для выхода"
    exit 1
}

Write-Host "🔧 Добавляем PostgreSQL в PATH..." -ForegroundColor Yellow
$env:PATH = "$pgPath;$env:PATH"

# Проверка подключения к PostgreSQL
Write-Host "🔍 Проверяем подключение к PostgreSQL..." -ForegroundColor Yellow
try {
    $result = psql -h localhost -U postgres -d postgres -c "SELECT 1;" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ PostgreSQL подключен" -ForegroundColor Green
    } else {
        throw "Не удается подключиться к PostgreSQL"
    }
} catch {
    Write-Host "❌ Не удается подключиться к PostgreSQL" -ForegroundColor Red
    Write-Host "🔧 Проверьте, что PostgreSQL запущен и доступен" -ForegroundColor Yellow
    Read-Host "Нажмите Enter для выхода"
    exit 1
}

# Проверка базы данных
Write-Host ""
Write-Host "[3/4] Проверка базы данных dropshipping_db..." -ForegroundColor Yellow
try {
    $result = psql -h localhost -U postgres -d dropshipping_db -c "SELECT 1;" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ База данных dropshipping_db доступна" -ForegroundColor Green
    } else {
        throw "База данных не найдена"
    }
} catch {
    Write-Host "❌ База данных dropshipping_db не найдена" -ForegroundColor Red
    Write-Host "🔧 Создайте базу данных с помощью setup-database.bat" -ForegroundColor Yellow
    Read-Host "Нажмите Enter для выхода"
    exit 1
}

# Предупреждение и подтверждение
Write-Host ""
Write-Host "[4/4] ⚠️  ВНИМАНИЕ! ВЫ СОБИРАЕТЕСЬ ОЧИСТИТЬ ВСЕ ДАННЫЕ!" -ForegroundColor Red
Write-Host ""
Write-Host "Это действие удалит:" -ForegroundColor Yellow
Write-Host "- Всех пользователей" -ForegroundColor White
Write-Host "- Всех клиентов" -ForegroundColor White
Write-Host "- Все заказы" -ForegroundColor White
Write-Host "- Все депозиты" -ForegroundColor White
Write-Host "- Все уведомления" -ForegroundColor White
Write-Host "- Все API ключи" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  ЭТО ДЕЙСТВИЕ НЕОБРАТИМО!" -ForegroundColor Red
Write-Host ""

$confirm = Read-Host "Вы уверены, что хотите продолжить? (введите 'YES' для подтверждения)"
if ($confirm -ne "YES") {
    Write-Host "❌ Операция отменена" -ForegroundColor Yellow
    Read-Host "Нажмите Enter для выхода"
    exit 0
}

Write-Host ""
Write-Host "🗑️  Начинаем очистку базы данных..." -ForegroundColor Yellow

# Очистка таблиц
Write-Host "📝 Удаляем все уведомления..." -ForegroundColor Yellow
psql -h localhost -U postgres -d dropshipping_db -c "DELETE FROM notifications;" 2>$null

Write-Host "📝 Удаляем все заказы..." -ForegroundColor Yellow
psql -h localhost -U postgres -d dropshipping_db -c "DELETE FROM orders;" 2>$null

Write-Host "📝 Удаляем все депозиты..." -ForegroundColor Yellow
psql -h localhost -U postgres -d dropshipping_db -c "DELETE FROM deposits;" 2>$null

Write-Host "📝 Удаляем всех клиентов..." -ForegroundColor Yellow
psql -h localhost -U postgres -d dropshipping_db -c "DELETE FROM clients;" 2>$null

Write-Host "📝 Удаляем всех пользователей..." -ForegroundColor Yellow
psql -h localhost -U postgres -d dropshipping_db -c "DELETE FROM users;" 2>$null

Write-Host "📝 Сбрасываем счетчики автоинкремента..." -ForegroundColor Yellow
psql -h localhost -U postgres -d dropshipping_db -c "ALTER SEQUENCE users_id_seq RESTART WITH 1;" 2>$null
psql -h localhost -U postgres -d dropshipping_db -c "ALTER SEQUENCE clients_id_seq RESTART WITH 1;" 2>$null
psql -h localhost -U postgres -d dropshipping_db -c "ALTER SEQUENCE orders_id_seq RESTART WITH 1;" 2>$null
psql -h localhost -U postgres -d dropshipping_db -c "ALTER SEQUENCE deposits_id_seq RESTART WITH 1;" 2>$null
psql -h localhost -U postgres -d dropshipping_db -c "ALTER SEQUENCE notifications_id_seq RESTART WITH 1;" 2>$null

Write-Host ""
Write-Host "✅ База данных успешно очищена!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Статистика:" -ForegroundColor Cyan
Write-Host "- Пользователи: 0" -ForegroundColor White
Write-Host "- Клиенты: 0" -ForegroundColor White
Write-Host "- Заказы: 0" -ForegroundColor White
Write-Host "- Депозиты: 0" -ForegroundColor White
Write-Host "- Уведомления: 0" -ForegroundColor White
Write-Host ""
Write-Host "🔄 Счетчики автоинкремента сброшены" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Теперь вы можете:" -ForegroundColor Cyan
Write-Host "- Запустить систему: .\start-fixed.bat" -ForegroundColor White
Write-Host "- Создать новых пользователей через регистрацию" -ForegroundColor White
Write-Host "- Настроить API ключи для каждого пользователя отдельно" -ForegroundColor White
Write-Host ""
Read-Host "Нажмите Enter для выхода"


