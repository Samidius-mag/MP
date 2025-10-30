#!/bin/bash

echo "========================================"
echo "   Запуск миграции для добавления поля password_changed_at"
echo "========================================"

# Переходим в директорию сервера
cd server

# Проверяем, существует ли файл миграции
if [ ! -f "migrations/20250119_add_password_changed_at.sql" ]; then
    echo "❌ Ошибка: Файл миграции не найден!"
    exit 1
fi

# Проверяем, установлен ли Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Ошибка: Node.js не установлен!"
    exit 1
fi

# Проверяем, существует ли package.json
if [ ! -f "package.json" ]; then
    echo "❌ Ошибка: package.json не найден!"
    exit 1
fi

# Устанавливаем зависимости, если node_modules не существует
if [ ! -d "node_modules" ]; then
    echo "📦 Установка зависимостей..."
    npm install
fi

# Запускаем миграцию
echo "🚀 Запуск миграции..."
node scripts/run-migrations.js

if [ $? -eq 0 ]; then
    echo "✅ Миграция успешно завершена!"
    echo "📝 Добавлено поле password_changed_at в таблицу users"
    echo "🔐 Теперь операторы будут обязаны сменить пароль при первом входе"
else
    echo "❌ Ошибка при выполнении миграции!"
    exit 1
fi

echo "========================================"




