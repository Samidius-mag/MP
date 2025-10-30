#!/bin/bash

# Скрипт для применения миграции СИМА ЛЕНД
# Использование: ./run-sima-land-migration.sh

echo "🚀 Применение миграции СИМА ЛЕНД..."
echo ""

# Проверяем наличие PostgreSQL
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL не найден. Установите PostgreSQL для продолжения."
    exit 1
fi

# Загружаем переменные окружения из .env (если существует)
if [ -f .env ]; then
    echo "📝 Загружаем переменные окружения из .env"
    export $(cat .env | grep -v '^#' | xargs)
fi

# Устанавливаем значения по умолчанию, если переменные не заданы
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-dropshipping_db}"
DB_USER="${DB_USER:-dropshipping}"
DB_PASSWORD="${DB_PASSWORD:-KeyOfWorld2025}"

echo "📊 Параметры подключения к БД:"
echo "   Хост: $DB_HOST"
echo "   Порт: $DB_PORT"
echo "   БД: $DB_NAME"
echo "   Пользователь: $DB_USER"
echo ""

# Проверяем подключение к базе данных
echo "🔍 Проверка подключения к базе данных..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT version();" > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo "❌ Не удалось подключиться к базе данных"
    echo "Проверьте параметры подключения в переменных окружения"
    exit 1
fi

echo "✅ Подключение к базе данных успешно"
echo ""

# Проверяем существование файла миграции
MIGRATION_FILE="server/migrations/20250124_create_sima_land_products.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Файл миграции не найден: $MIGRATION_FILE"
    exit 1
fi

echo "📄 Файл миграции найден: $MIGRATION_FILE"
echo ""

# Применяем миграцию
echo "🔄 Применение миграции..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$MIGRATION_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Миграция успешно применена!"
    echo ""
    echo "📋 Проверяем созданную таблицу..."
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "\d sima_land_products"
    echo ""
    echo "🎉 Готово! Теперь можно использовать интеграцию с СИМА ЛЕНД."
else
    echo ""
    echo "❌ Ошибка при применении миграции"
    exit 1
fi

