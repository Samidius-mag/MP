#!/bin/bash

# Скрипт для применения миграции расширения товаров магазина для маркетплейсов
# Использование: ./run-store-products-migration.sh

echo "🚀 Применение миграции расширения товаров магазина для маркетплейсов..."
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
MIGRATION_FILE="server/migrations/20250125_extend_store_products_for_marketplaces.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Файл миграции не найден: $MIGRATION_FILE"
    exit 1
fi

echo "📄 Файл миграции найден: $MIGRATION_FILE"
echo ""

# Проверяем существование таблицы wb_products_cache
echo "🔍 Проверка существования таблицы wb_products_cache..."
TABLE_EXISTS=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'wb_products_cache');")

if [ "$TABLE_EXISTS" != "t" ]; then
    echo "❌ Таблица wb_products_cache не найдена"
    echo "Сначала необходимо выполнить миграцию создания модуля ценообразования:"
    echo "   ./run-pricing-migration.sh"
    exit 1
fi

echo "✅ Таблица wb_products_cache найдена"
echo ""

# Применяем миграцию
echo "🔄 Применение миграции..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$MIGRATION_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Миграция успешно применена!"
    echo ""
    
    # Проверяем добавленные поля
    echo "📋 Проверяем добавленные поля в таблице wb_products_cache..."
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
        SELECT column_name, data_type, is_nullable, column_default 
        FROM information_schema.columns 
        WHERE table_name = 'wb_products_cache' 
        AND column_name IN ('source', 'purchase_price', 'available_quantity', 'markup_percent', 'marketplace_targets', 'yandex_market_sku', 'image_url', 'description')
        ORDER BY column_name;
    "
    echo ""
    
    # Проверяем индексы
    echo "📋 Проверяем созданные индексы..."
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'wb_products_cache' 
        AND indexname LIKE '%client_article_source%' OR indexname LIKE '%market%'
        ORDER BY indexname;
    "
    echo ""
    
    echo "🎉 Готово! Таблица товаров магазина расширена для поддержки маркетплейсов."
    echo ""
    echo "📝 Что было добавлено:"
    echo "   - Поле source (источник товара: wildberries, sima_land)"
    echo "   - Поле purchase_price (закупочная цена)"
    echo "   - Поле available_quantity (остатки)"
    echo "   - Поле markup_percent (наценка в процентах)"
    echo "   - Поле marketplace_targets (выбранные маркетплейсы)"
    echo "   - Поле yandex_market_sku (SKU на Яндекс Маркете)"
    echo "   - Поле image_url (URL изображения)"
    echo "   - Поле description (описание товара)"
    echo "   - Уникальный индекс по (client_id, article, source)"
    echo ""
else
    echo ""
    echo "❌ Ошибка при применении миграции"
    exit 1
fi

