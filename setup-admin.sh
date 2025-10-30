#!/bin/bash

echo "========================================"
echo "  Настройка интерфейса администратора"
echo "========================================"
echo

echo "1. Установка зависимостей сервера..."
cd server
npm install
if [ $? -ne 0 ]; then
    echo "Ошибка установки зависимостей сервера"
    exit 1
fi

echo
echo "2. Установка зависимостей клиента..."
cd ../client
npm install
if [ $? -ne 0 ]; then
    echo "Ошибка установки зависимостей клиента"
    exit 1
fi

echo
echo "3. Создание пользователя-администратора..."
cd ../server
npm run create-admin
if [ $? -ne 0 ]; then
    echo "Ошибка создания администратора"
    exit 1
fi

echo
echo "========================================"
echo "  Настройка завершена успешно!"
echo "========================================"
echo
echo "Для запуска системы:"
echo "1. Запустите сервер: cd server && npm start"
echo "2. Запустите клиент: cd client && npm run dev"
echo "3. Откройте http://localhost:3000"
echo "4. Войдите под учетной записью администратора"
echo "5. Перейдите на /admin"
echo
echo "Данные администратора по умолчанию:"
echo "Email: admin@dropshipping.com"
echo "Пароль: Admin123!"
echo





