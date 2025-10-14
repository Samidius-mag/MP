# Скрипт установки зависимостей для системы автоматизации дропшиппинга
# Запуск: .\install.ps1

Write-Host "🚀 Установка системы автоматизации дропшиппинга..." -ForegroundColor Green

# Проверка наличия Node.js
Write-Host "📋 Проверка Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js найден: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js не найден. Установите Node.js 18+ с https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Проверка наличия PostgreSQL
Write-Host "📋 Проверка PostgreSQL..." -ForegroundColor Yellow
try {
    $pgVersion = psql --version
    Write-Host "✅ PostgreSQL найден: $pgVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ PostgreSQL не найден. Установите PostgreSQL 13+ с https://www.postgresql.org/" -ForegroundColor Red
    Write-Host "💡 Или используйте Docker: docker run --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:13" -ForegroundColor Blue
}

# Установка корневых зависимостей
Write-Host "📦 Установка корневых зависимостей..." -ForegroundColor Yellow
npm install

# Установка зависимостей сервера
Write-Host "📦 Установка зависимостей сервера..." -ForegroundColor Yellow
Set-Location server
npm install
Set-Location ..

# Установка зависимостей клиента
Write-Host "📦 Установка зависимостей клиента..." -ForegroundColor Yellow
Set-Location client
npm install
Set-Location ..

# Создание .env файла для сервера
Write-Host "⚙️ Настройка переменных окружения..." -ForegroundColor Yellow
if (!(Test-Path "server\.env")) {
    Copy-Item "server\env.example" "server\.env"
    Write-Host "✅ Создан файл server\.env" -ForegroundColor Green
    Write-Host "⚠️ Не забудьте настроить переменные в server\.env" -ForegroundColor Yellow
} else {
    Write-Host "✅ Файл server\.env уже существует" -ForegroundColor Green
}

# Создание базы данных PostgreSQL
Write-Host "🗄️ Настройка базы данных..." -ForegroundColor Yellow
Write-Host "Создайте базу данных PostgreSQL:" -ForegroundColor Blue
Write-Host "1. Откройте psql или pgAdmin" -ForegroundColor Blue
Write-Host "2. Выполните: CREATE DATABASE dropshipping_db;" -ForegroundColor Blue
Write-Host "3. Убедитесь, что пользователь postgres имеет доступ к базе" -ForegroundColor Blue

Write-Host "`n🎉 Установка завершена!" -ForegroundColor Green
Write-Host "`n📋 Следующие шаги:" -ForegroundColor Yellow
Write-Host "1. Настройте переменные в server\.env" -ForegroundColor Blue
Write-Host "2. Создайте базу данных PostgreSQL" -ForegroundColor Blue
Write-Host "3. Запустите приложение: npm run dev" -ForegroundColor Blue
Write-Host "4. Откройте http://localhost:3000" -ForegroundColor Blue

Write-Host "`n🔧 Команды для запуска:" -ForegroundColor Yellow
Write-Host "npm run dev          # Запуск всех сервисов" -ForegroundColor Blue
Write-Host "npm run server:dev   # Только сервер" -ForegroundColor Blue
Write-Host "npm run client:dev   # Только клиент" -ForegroundColor Blue
Write-Host "npm run build        # Сборка для продакшена" -ForegroundColor Blue



