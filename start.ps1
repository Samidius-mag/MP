# Скрипт запуска системы автоматизации дропшиппинга
# Запуск: .\start.ps1

Write-Host "🚀 Запуск системы автоматизации дропшиппинга..." -ForegroundColor Green

# Проверка наличия .env файла
if (!(Test-Path "server\.env")) {
    Write-Host "❌ Файл server\.env не найден!" -ForegroundColor Red
    Write-Host "💡 Скопируйте server\env.example в server\.env и настройте переменные" -ForegroundColor Yellow
    exit 1
}

# Проверка подключения к PostgreSQL
Write-Host "📋 Проверка подключения к PostgreSQL..." -ForegroundColor Yellow
try {
    $env:PGPASSWORD = "postgres"
    $result = psql -h localhost -U postgres -d dropshipping_db -c "SELECT 1;" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Подключение к PostgreSQL успешно" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Не удалось подключиться к PostgreSQL" -ForegroundColor Yellow
        Write-Host "💡 Убедитесь, что PostgreSQL запущен и база dropshipping_db создана" -ForegroundColor Blue
    }
} catch {
    Write-Host "⚠️ Не удалось проверить подключение к PostgreSQL" -ForegroundColor Yellow
}

# Запуск приложения
Write-Host "`n🚀 Запуск приложения..." -ForegroundColor Green
Write-Host "Сервер будет доступен на: http://localhost:3001" -ForegroundColor Blue
Write-Host "Клиент будет доступен на: http://localhost:3000" -ForegroundColor Blue
Write-Host "`nДля остановки нажмите Ctrl+C" -ForegroundColor Yellow

npm run dev





