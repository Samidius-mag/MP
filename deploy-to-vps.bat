@echo off
echo ========================================
echo   Развертывание проекта на VPS сервер
echo ========================================

REM Проверяем наличие Git
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ОШИБКА: Git не установлен или не найден в PATH
    pause
    exit /b 1
)

REM Читаем конфигурацию из файла
if not exist "deploy-config.txt" (
    echo Создаем файл конфигурации deploy-config.txt...
    echo VPS_HOST=your-server-ip
    echo VPS_USER=root
    echo VPS_PORT=22
    echo PROJECT_PATH=/var/www/dropshipping
    echo GIT_REPO=https://github.com/your-username/your-repo.git
    echo BRANCH=main
    echo PM2_APP_NAME=dropshipping-app
    echo.
    echo Пожалуйста, отредактируйте файл deploy-config.txt с вашими настройками
    pause
    exit /b 1
)

REM Загружаем конфигурацию
for /f "tokens=1,2 delims==" %%a in (deploy-config.txt) do (
    if "%%a"=="VPS_HOST" set VPS_HOST=%%b
    if "%%a"=="VPS_USER" set VPS_USER=%%b
    if "%%a"=="VPS_PORT" set VPS_PORT=%%b
    if "%%a"=="PROJECT_PATH" set PROJECT_PATH=%%b
    if "%%a"=="GIT_REPO" set GIT_REPO=%%b
    if "%%a"=="BRANCH" set BRANCH=%%b
    if "%%a"=="PM2_APP_NAME" set PM2_APP_NAME=%%b
)

echo Конфигурация:
echo   Сервер: %VPS_USER%@%VPS_HOST%:%VPS_PORT%
echo   Путь: %PROJECT_PATH%
echo   Репозиторий: %GIT_REPO%
echo   Ветка: %BRANCH%
echo.

REM Проверяем подключение к серверу
echo Проверяем подключение к серверу...
ssh -p %VPS_PORT% -o ConnectTimeout=10 %VPS_USER%@%VPS_HOST% "echo 'Подключение успешно'" 2>nul
if %errorlevel% neq 0 (
    echo ОШИБКА: Не удается подключиться к серверу
    echo Убедитесь, что:
    echo 1. SSH ключи настроены правильно
    echo 2. Сервер доступен
    echo 3. Данные в deploy-config.txt корректны
    pause
    exit /b 1
)

echo Подключение успешно!
echo.

REM Создаем скрипт развертывания
echo Создаем скрипт развертывания на сервере...
ssh -p %VPS_PORT% %VPS_USER%@%VPS_HOST% "cat > /tmp/deploy.sh << 'EOF'
#!/bin/bash
set -e

echo '=== Начинаем развертывание ==='

# Переходим в директорию проекта
cd %PROJECT_PATH%

# Останавливаем приложение
echo 'Останавливаем приложение...'
pm2 stop %PM2_APP_NAME% 2>/dev/null || echo 'Приложение не запущено'

# Сохраняем резервную копию
echo 'Создаем резервную копию...'
if [ -d \"%PROJECT_PATH%\"]; then
    cp -r %PROJECT_PATH% %PROJECT_PATH%.backup.\$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
fi

# Обновляем код из Git
echo 'Обновляем код из репозитория...'
if [ -d \".git\" ]; then
    git fetch origin
    git reset --hard origin/%BRANCH%
    git clean -fd
else
    echo 'Клонируем репозиторий...'
    git clone %GIT_REPO% .
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
EOF"

REM Выполняем развертывание
echo Выполняем развертывание на сервере...
ssh -p %VPS_PORT% %VPS_USER%@%VPS_HOST% "chmod +x /tmp/deploy.sh && /tmp/deploy.sh"

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   РАЗВЕРТЫВАНИЕ ЗАВЕРШЕНО УСПЕШНО!
    echo ========================================
    echo.
    echo Приложение доступно по адресу: http://%VPS_HOST%
    echo.
    echo Для мониторинга используйте:
    echo   pm2 status
    echo   pm2 logs %PM2_APP_NAME%
    echo   pm2 monit
) else (
    echo.
    echo ========================================
    echo   ОШИБКА ПРИ РАЗВЕРТЫВАНИИ!
    echo ========================================
    echo Проверьте логи выше для диагностики
)

echo.
pause

