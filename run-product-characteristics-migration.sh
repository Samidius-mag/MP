#!/bin/bash

# Скрипт для применения миграции добавления поля characteristics для товаров
# Использование: ./run-product-characteristics-migration.sh

echo "🚀 Применение миграции добавления поля characteristics для товаров..."
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
MIGRATION_FILE="server/migrations/20250126_add_product_characteristics.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Файл миграции не найден: $MIGRATION_FILE"
    exit 1
fi

echo "📄 Файл миграции найден: $MIGRATION_FILE"
echo ""

# Проверяем существование таблиц
echo "🔍 Проверка существования таблиц..."
WB_TABLE_EXISTS=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'wb_products_cache');")
SIMA_PRODUCTS_EXISTS=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sima_land_products');")
SIMA_CATALOG_EXISTS=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sima_land_catalog');")

if [ "$WB_TABLE_EXISTS" != "t" ]; then
    echo "⚠️  Таблица wb_products_cache не найдена (будет пропущена)"
fi

if [ "$SIMA_PRODUCTS_EXISTS" != "t" ]; then
    echo "⚠️  Таблица sima_land_products не найдена (будет пропущена)"
fi

if [ "$SIMA_CATALOG_EXISTS" != "t" ]; then
    echo "⚠️  Таблица sima_land_catalog не найдена (будет пропущена)"
fi

echo ""

# Применяем миграцию
echo "🔄 Применение миграции..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$MIGRATION_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Миграция успешно применена!"
    echo ""
    
    # Проверяем добавленное поле в wb_products_cache
    if [ "$WB_TABLE_EXISTS" == "t" ]; then
        echo "📋 Проверяем добавленное поле в таблице wb_products_cache..."
        PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
            SELECT column_name, data_type, is_nullable, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'wb_products_cache' 
            AND column_name = 'characteristics';
        "
        echo ""
        
        # Проверяем индекс
        echo "📋 Проверяем созданный индекс для characteristics..."
        PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
            SELECT indexname, indexdef 
            FROM pg_indexes 
            WHERE tablename = 'wb_products_cache' 
            AND indexname LIKE '%characteristics%'
            ORDER BY indexname;
        "
        echo ""
    fi
    
    # Проверяем добавленное поле в sima_land_products
    if [ "$SIMA_PRODUCTS_EXISTS" == "t" ]; then
        echo "📋 Проверяем добавленное поле в таблице sima_land_products..."
        PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
            SELECT column_name, data_type, is_nullable, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'sima_land_products' 
            AND column_name = 'characteristics';
        "
        echo ""
    fi
    
    # Проверяем добавленное поле в sima_land_catalog
    if [ "$SIMA_CATALOG_EXISTS" == "t" ]; then
        echo "📋 Проверяем добавленное поле в таблице sima_land_catalog..."
        PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
            SELECT column_name, data_type, is_nullable, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'sima_land_catalog' 
            AND column_name = 'characteristics';
        "
        echo ""
    fi
    
    echo "🎉 Готово! Поле characteristics добавлено в таблицы товаров."
    echo ""
    echo "📝 Что было добавлено:"
    echo "   - Поле characteristics (JSONB) в wb_products_cache"
    echo "   - Поле characteristics (JSONB) в sima_land_products"
    echo "   - Поле characteristics (JSONB) в sima_land_catalog"
    echo "   - GIN индексы для быстрого поиска по характеристикам"
    echo ""
    echo "💡 Теперь система может:"
    echo "   - Извлекать характеристики (цвет, размер, материал) из Sima Land API"
    echo "   - Сохранять характеристики в БД"
    echo "   - Автоматически маппить характеристики на параметры Яндекс.Маркет"
    echo ""
else
    echo ""
    echo "❌ Ошибка при применении миграции"
    exit 1
fi

