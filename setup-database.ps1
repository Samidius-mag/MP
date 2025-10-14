# Скрипт настройки базы данных PostgreSQL
# Запуск: .\setup-database.ps1

Write-Host "🗄️ Настройка базы данных PostgreSQL..." -ForegroundColor Green

# Параметры подключения
$DB_HOST = "localhost"
$DB_PORT = "5432"
$DB_NAME = "dropshipping_db"
$DB_USER = "postgres"
$DB_PASSWORD = "postgres"

Write-Host "📋 Параметры подключения:" -ForegroundColor Yellow
Write-Host "Хост: $DB_HOST" -ForegroundColor Blue
Write-Host "Порт: $DB_PORT" -ForegroundColor Blue
Write-Host "База данных: $DB_NAME" -ForegroundColor Blue
Write-Host "Пользователь: $DB_USER" -ForegroundColor Blue

# Установка переменной окружения для пароля
$env:PGPASSWORD = $DB_PASSWORD

Write-Host "`n🔍 Проверка подключения к PostgreSQL..." -ForegroundColor Yellow
try {
    $result = psql -h $DB_HOST -U $DB_USER -d postgres -c "SELECT version();" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Подключение к PostgreSQL успешно" -ForegroundColor Green
    } else {
        Write-Host "❌ Не удалось подключиться к PostgreSQL" -ForegroundColor Red
        Write-Host "💡 Убедитесь, что PostgreSQL запущен и доступен" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "❌ Ошибка подключения к PostgreSQL" -ForegroundColor Red
    Write-Host "💡 Проверьте, что PostgreSQL установлен и запущен" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n🔍 Проверка существования базы данных..." -ForegroundColor Yellow
try {
    $result = psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1;" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ База данных $DB_NAME уже существует" -ForegroundColor Green
    } else {
        Write-Host "📦 Создание базы данных $DB_NAME..." -ForegroundColor Yellow
        $createDbResult = psql -h $DB_HOST -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;" 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ База данных $DB_NAME создана успешно" -ForegroundColor Green
        } else {
            Write-Host "❌ Ошибка создания базы данных" -ForegroundColor Red
            Write-Host "💡 Попробуйте создать базу данных вручную:" -ForegroundColor Yellow
            Write-Host "psql -U postgres -c `"CREATE DATABASE $DB_NAME;`"" -ForegroundColor Blue
            exit 1
        }
    }
} catch {
    Write-Host "❌ Ошибка проверки базы данных" -ForegroundColor Red
    exit 1
}

Write-Host "`n🔍 Проверка таблиц..." -ForegroundColor Yellow
try {
    $result = psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';" 2>$null
    if ($LASTEXITCODE -eq 0) {
        $tables = $result | Where-Object { $_ -match "^\s*\w+" } | ForEach-Object { $_.Trim() }
        if ($tables.Count -gt 0) {
            Write-Host "✅ Найдены таблицы: $($tables -join ', ')" -ForegroundColor Green
        } else {
            Write-Host "⚠️ Таблицы не найдены. Они будут созданы при первом запуске сервера." -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "⚠️ Не удалось проверить таблицы" -ForegroundColor Yellow
}

Write-Host "`n🎉 Настройка базы данных завершена!" -ForegroundColor Green
Write-Host "`n📋 Следующие шаги:" -ForegroundColor Yellow
Write-Host "1. Убедитесь, что server\.env настроен правильно" -ForegroundColor Blue
Write-Host "2. Запустите приложение: npm run dev" -ForegroundColor Blue
Write-Host "3. Таблицы будут созданы автоматически при первом запуске" -ForegroundColor Blue

Write-Host "`n💡 Если возникли проблемы:" -ForegroundColor Yellow
Write-Host "- Проверьте, что PostgreSQL запущен" -ForegroundColor Blue
Write-Host "- Убедитесь, что пользователь postgres имеет права на создание баз данных" -ForegroundColor Blue
Write-Host "- Проверьте настройки в server\.env" -ForegroundColor Blue



