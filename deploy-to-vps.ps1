# PowerShell скрипт для развертывания на VPS
param(
    [string]$ConfigFile = "deploy-config.txt",
    [switch]$Force = $false
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Развертывание проекта на VPS сервер" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Проверяем наличие Git
try {
    $gitVersion = git --version
    Write-Host "Git найден: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "ОШИБКА: Git не установлен или не найден в PATH" -ForegroundColor Red
    exit 1
}

# Проверяем наличие конфигурационного файла
if (-not (Test-Path $ConfigFile)) {
    Write-Host "Создаем файл конфигурации $ConfigFile..." -ForegroundColor Yellow
    $configContent = @"
VPS_HOST=your-server-ip
VPS_USER=root
VPS_PORT=22
PROJECT_PATH=/var/www/dropshipping
GIT_REPO=https://github.com/your-username/your-repo.git
BRANCH=main
PM2_APP_NAME=dropshipping-app
"@
    $configContent | Out-File -FilePath $ConfigFile -Encoding UTF8
    Write-Host "Пожалуйста, отредактируйте файл $ConfigFile с вашими настройками" -ForegroundColor Yellow
    exit 1
}

# Загружаем конфигурацию
Write-Host "Загружаем конфигурацию из $ConfigFile..." -ForegroundColor Green
$config = @{}
Get-Content $ConfigFile | ForEach-Object {
    if ($_ -match "^([^=]+)=(.*)$") {
        $config[$matches[1]] = $matches[2]
    }
}

# Проверяем обязательные параметры
$requiredParams = @("VPS_HOST", "VPS_USER", "VPS_PORT", "PROJECT_PATH", "GIT_REPO", "BRANCH", "PM2_APP_NAME")
foreach ($param in $requiredParams) {
    if (-not $config.ContainsKey($param) -or $config[$param] -eq "") {
        Write-Host "ОШИБКА: Отсутствует обязательный параметр $param в $ConfigFile" -ForegroundColor Red
        exit 1
    }
}

Write-Host "Конфигурация:" -ForegroundColor Green
Write-Host "  Сервер: $($config.VPS_USER)@$($config.VPS_HOST):$($config.VPS_PORT)" -ForegroundColor White
Write-Host "  Путь: $($config.PROJECT_PATH)" -ForegroundColor White
Write-Host "  Репозиторий: $($config.GIT_REPO)" -ForegroundColor White
Write-Host "  Ветка: $($config.BRANCH)" -ForegroundColor White
Write-Host ""

# Проверяем подключение к серверу
Write-Host "Проверяем подключение к серверу..." -ForegroundColor Green
try {
    $testConnection = ssh -p $config.VPS_PORT -o ConnectTimeout=10 "$($config.VPS_USER)@$($config.VPS_HOST)" "echo 'Подключение успешно'" 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Ошибка подключения"
    }
    Write-Host "Подключение успешно!" -ForegroundColor Green
} catch {
    Write-Host "ОШИБКА: Не удается подключиться к серверу" -ForegroundColor Red
    Write-Host "Убедитесь, что:" -ForegroundColor Yellow
    Write-Host "1. SSH ключи настроены правильно" -ForegroundColor Yellow
    Write-Host "2. Сервер доступен" -ForegroundColor Yellow
    Write-Host "3. Данные в $ConfigFile корректны" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Создаем скрипт развертывания
Write-Host "Создаем скрипт развертывания на сервере..." -ForegroundColor Green
$deployScript = @"
#!/bin/bash
set -e

echo '=== Начинаем развертывание ==='

# Переходим в директорию проекта
cd $($config.PROJECT_PATH)

# Останавливаем приложение
echo 'Останавливаем приложение...'
pm2 stop $($config.PM2_APP_NAME) 2>/dev/null || echo 'Приложение не запущено'

# Сохраняем резервную копию
echo 'Создаем резервную копию...'
if [ -d "$($config.PROJECT_PATH)" ]; then
    cp -r $($config.PROJECT_PATH) $($config.PROJECT_PATH).backup.`$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
fi

# Обновляем код из Git
echo 'Обновляем код из репозитория...'
if [ -d ".git" ]; then
    git fetch origin
    git reset --hard origin/$($config.BRANCH)
    git clean -fd
else
    echo 'Клонируем репозиторий...'
    git clone $($config.GIT_REPO) .
fi

# Устанавливаем зависимости
echo 'Устанавливаем зависимости сервера...'
cd server
npm ci --production

echo 'Устанавливаем зависимости клиента...'
cd ../client
npm ci
npm run build

# Возвращаемся в корень проекта
cd ..

# Запускаем приложение
echo 'Запускаем приложение...'
pm2 start ecosystem.config.js --env production
pm2 save

echo '=== Развертывание завершено успешно! ==='
echo 'Статус приложения:'
pm2 status
"@

# Отправляем скрипт на сервер и выполняем
$deployScript | ssh -p $config.VPS_PORT "$($config.VPS_USER)@$($config.VPS_HOST)" "cat > /tmp/deploy.sh && chmod +x /tmp/deploy.sh && /tmp/deploy.sh"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "   РАЗВЕРТЫВАНИЕ ЗАВЕРШЕНО УСПЕШНО!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Приложение доступно по адресу: http://$($config.VPS_HOST)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Для мониторинга используйте:" -ForegroundColor Yellow
    Write-Host "  pm2 status" -ForegroundColor White
    Write-Host "  pm2 logs $($config.PM2_APP_NAME)" -ForegroundColor White
    Write-Host "  pm2 monit" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "   ОШИБКА ПРИ РАЗВЕРТЫВАНИИ!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "Проверьте логи выше для диагностики" -ForegroundColor Yellow
    exit 1
}

Write-Host ""



