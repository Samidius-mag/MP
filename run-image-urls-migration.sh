#!/bin/bash

# Скрипт для применения миграции добавления массива изображений товара
# Использование: ./run-image-urls-migration.sh

echo "🚀 Применение миграции добавления массива изображений товара..."
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

# Если .env не найден, пробуем загрузить из server/env.example или server/.env
if [ -f server/.env ]; then
    echo "📝 Загружаем переменные окружения из server/.env"
    export $(cat server/.env | grep -v '^#' | xargs)
elif [ -f server/env.example ]; then
    echo "📝 Загружаем переменные окружения из server/env.example"
    export $(cat server/env.example | grep -v '^#' | xargs)
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
MIGRATION_FILE="server/migrations/20250127_add_image_urls.sql"

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
    
    # Проверяем добавленные поля
    echo "📋 Проверяем добавленные поля в таблицах..."
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
        SELECT table_name, column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE column_name = 'image_urls' AND table_name IN ('sima_land_products', 'sima_land_catalog')
        ORDER BY table_name;
    "
    echo ""
    
    # Проверяем индексы
    echo "📋 Проверяем созданные индексы..."
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE indexname LIKE '%image_urls%'
        ORDER BY indexname;
    "
    echo ""
    
    echo "🎉 Готово! Поле массива изображений добавлено в таблицы."
    echo ""
else
    echo ""
    echo "❌ Ошибка при применении миграции"
    exit 1
fi

