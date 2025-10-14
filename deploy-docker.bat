@echo off
echo ========================================
echo   Развертывание через Docker на VPS
echo ========================================

REM Проверяем наличие Docker
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ОШИБКА: Docker не установлен или не найден в PATH
    pause
    exit /b 1
)

REM Читаем конфигурацию
if not exist "deploy-config.txt" (
    echo Создаем файл конфигурации deploy-config.txt...
    echo VPS_HOST=your-server-ip
    echo VPS_USER=root
    echo VPS_PORT=22
    echo PROJECT_PATH=/var/www/dropshipping
    echo DOCKER_COMPOSE_FILE=docker-compose.yml
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
    if "%%a"=="DOCKER_COMPOSE_FILE" set DOCKER_COMPOSE_FILE=%%b
)

echo Конфигурация:
echo   Сервер: %VPS_USER%@%VPS_HOST%:%VPS_PORT%
echo   Путь: %PROJECT_PATH%
echo   Docker Compose: %DOCKER_COMPOSE_FILE%
echo.

REM Проверяем подключение к серверу
echo Проверяем подключение к серверу...
ssh -p %VPS_PORT% -o ConnectTimeout=10 %VPS_USER%@%VPS_HOST% "echo 'Подключение успешно'" 2>nul
if %errorlevel% neq 0 (
    echo ОШИБКА: Не удается подключиться к серверу
    pause
    exit /b 1
)

echo Подключение успешно!
echo.

REM Создаем архив с проектом
echo Создаем архив с проектом...
tar -czf project.tar.gz --exclude=node_modules --exclude=.git --exclude=.next --exclude=*.log client/ server/ package.json package-lock.json docker-compose.yml Dockerfile.* nginx.conf

REM Копируем архив на сервер
echo Копируем архив на сервер...
scp -P %VPS_PORT% project.tar.gz %VPS_USER%@%VPS_HOST%:%PROJECT_PATH%/

REM Выполняем развертывание на сервере
echo Выполняем развертывание на сервере...
ssh -p %VPS_PORT% %VPS_USER%@%VPS_HOST% "cd %PROJECT_PATH% && tar -xzf project.tar.gz && rm project.tar.gz && docker-compose down && docker-compose up -d --build"

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   РАЗВЕРТЫВАНИЕ ЗАВЕРШЕНО УСПЕШНО!
    echo ========================================
    echo.
    echo Приложение доступно по адресу: http://%VPS_HOST%
    echo.
    echo Для мониторинга используйте:
    echo   docker-compose ps
    echo   docker-compose logs -f
) else (
    echo.
    echo ========================================
    echo   ОШИБКА ПРИ РАЗВЕРТЫВАНИИ!
    echo ========================================
)

REM Удаляем локальный архив
del project.tar.gz

echo.
pause



