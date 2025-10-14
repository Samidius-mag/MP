@echo off
chcp 65001 >nul
title Остановка системы автоматизации дропшиппинга

echo.
echo ========================================
echo   ОСТАНОВКА СИСТЕМЫ ДРОПШИППИНГА
echo ========================================
echo.

echo [1/2] Поиск процессов Node.js...
tasklist /FI "IMAGENAME eq node.exe" 2>NUL | find /I /N "node.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo ✅ Найдены процессы Node.js
    echo.
    echo Останавливаем процессы Node.js...
    taskkill /F /IM node.exe >nul 2>&1
    if %errorlevel% neq 0 (
        echo ❌ Не удалось остановить процессы Node.js
        pause
        exit /b 1
    )
    echo ✅ Процессы Node.js остановлены
) else (
    echo ℹ️ Процессы Node.js не найдены
)

echo.
echo [2/2] Проверка портов...
netstat -ano | findstr ":3000" >nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️ Порт 3000 все еще занят
) else (
    echo ✅ Порт 3000 свободен
)

netstat -ano | findstr ":3001" >nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️ Порт 3001 все еще занят
) else (
    echo ✅ Порт 3001 свободен
)

echo.
echo 🎉 Система остановлена!
echo.
echo 💡 Для запуска системы выполните start.bat
echo.
pause





