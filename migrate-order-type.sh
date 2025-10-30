#!/bin/bash

# Скрипт для выполнения миграции order_type на Linux сервере
# Автор: AI Assistant
# Дата: 2025-01-15

echo "========================================"
echo "   Миграция: Добавление поля order_type"
echo "========================================"
echo

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для вывода сообщений
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Проверяем, что мы в правильной директории
if [ ! -f "server/package.json" ]; then
    print_error "Скрипт должен быть запущен из корневой директории проекта!"
    exit 1
fi

print_status "Начинаем миграцию базы данных..."

# Переходим в директорию сервера
cd server

# Проверяем, что Node.js установлен
if ! command -v node &> /dev/null; then
    print_error "Node.js не найден! Установите Node.js для продолжения."
    exit 1
fi

# Проверяем, что файл миграции существует
if [ ! -f "scripts/run-migrations.js" ]; then
    print_error "Файл миграции не найден: server/scripts/run-migrations.js"
    exit 1
fi

# Проверяем, что файл миграции SQL существует
if [ ! -f "migrations/20250115_add_order_type_simple.sql" ]; then
    print_error "Файл SQL миграции не найден: server/migrations/20250115_add_order_type_simple.sql"
    exit 1
fi

print_status "Выполняем миграцию через Node.js скрипт..."

# Запускаем миграцию
if node scripts/run-migrations.js; then
    print_success "Миграция выполнена успешно!"
else
    print_error "Ошибка при выполнении миграции!"
    exit 1
fi

echo
print_status "Проверяем результат миграции..."

# Возвращаемся в корневую директорию
cd ..

# Запускаем проверку миграции
if [ -f "check-migration.js" ]; then
    if node check-migration.js; then
        print_success "Проверка миграции завершена!"
    else
        print_warning "Не удалось выполнить проверку миграции, но миграция могла пройти успешно."
    fi
else
    print_warning "Файл проверки миграции не найден, пропускаем проверку."
fi

echo
print_success "Миграция order_type завершена!"
print_status "Теперь можно перезапустить сервер и проверить импорт заказов."

echo
echo "========================================"
echo "   Следующие шаги:"
echo "========================================"
echo "1. Перезапустите сервер:"
echo "   - Docker: docker-compose restart"
echo "   - Локально: cd server && npm start"
echo
echo "2. Проверьте импорт заказов в веб-интерфейсе"
echo "3. Убедитесь, что заказы отображаются с типами (FBS, DBW, DBS)"
echo
