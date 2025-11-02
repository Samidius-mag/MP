#!/bin/bash

# Скрипт для очистки товаров Sima Land из базы данных
# Использование: ./clear-sima-land-products.sh [--catalog-only] [--confirm]

echo "🗑️  Скрипт очистки товаров Sima Land из базы данных"
echo ""

# Проверяем флаги
CLEAR_CATALOG_ONLY=false
NEED_CONFIRM=true

for arg in "$@"; do
  case $arg in
    --catalog-only)
      CLEAR_CATALOG_ONLY=true
      shift
      ;;
    --confirm)
      NEED_CONFIRM=false
      shift
      ;;
    *)
      ;;
  esac
done

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

# Подсчитываем количество записей перед удалением
echo "📊 Подсчет записей перед удалением..."

if [ "$CLEAR_CATALOG_ONLY" = true ]; then
    CATALOG_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM sima_land_catalog;" 2>/dev/null | tr -d ' ')
    
    if [ -z "$CATALOG_COUNT" ]; then
        CATALOG_COUNT=0
    fi
    
    echo "   Каталог (sima_land_catalog): $CATALOG_COUNT товаров"
else
    PRODUCTS_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM sima_land_products;" 2>/dev/null | tr -d ' ')
    CATALOG_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM sima_land_catalog;" 2>/dev/null | tr -d ' ')
    
    if [ -z "$PRODUCTS_COUNT" ]; then
        PRODUCTS_COUNT=0
    fi
    if [ -z "$CATALOG_COUNT" ]; then
        CATALOG_COUNT=0
    fi
    
    echo "   Товары клиентов (sima_land_products): $PRODUCTS_COUNT товаров"
    echo "   Каталог (sima_land_catalog): $CATALOG_COUNT товаров"
    TOTAL_COUNT=$((PRODUCTS_COUNT + CATALOG_COUNT))
    echo "   Всего: $TOTAL_COUNT товаров"
fi

echo ""

# Если записей нет, выходим
if [ "$CLEAR_CATALOG_ONLY" = true ]; then
    if [ "$CATALOG_COUNT" -eq 0 ]; then
        echo "ℹ️  Каталог уже пуст. Нечего удалять."
        exit 0
    fi
else
    if [ "$TOTAL_COUNT" -eq 0 ]; then
        echo "ℹ️  База данных уже пуста. Нечего удалять."
        exit 0
    fi
fi

# Запрашиваем подтверждение, если не передан флаг --confirm
if [ "$NEED_CONFIRM" = true ]; then
    echo "⚠️  ВНИМАНИЕ: Это действие удалит товары из базы данных!"
    if [ "$CLEAR_CATALOG_ONLY" = true ]; then
        echo "   Будет удалено: $CATALOG_COUNT товаров из каталога"
    else
        echo "   Будет удалено: $TOTAL_COUNT товаров"
        echo "   - $PRODUCTS_COUNT товаров клиентов"
        echo "   - $CATALOG_COUNT товаров каталога"
    fi
    echo ""
    read -p "Вы уверены? (yes/no): " CONFIRM
    
    if [ "$CONFIRM" != "yes" ]; then
        echo "❌ Операция отменена пользователем"
        exit 0
    fi
    echo ""
fi

# Выполняем удаление
echo "🔄 Удаление товаров..."

if [ "$CLEAR_CATALOG_ONLY" = true ]; then
    echo "   Удаление товаров из каталога..."
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "DELETE FROM sima_land_catalog;" 2>&1
    
    if [ $? -eq 0 ]; then
        echo "   ✅ Каталог очищен успешно"
    else
        echo "   ❌ Ошибка при очистке каталога"
        exit 1
    fi
else
    echo "   Удаление товаров клиентов..."
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "DELETE FROM sima_land_products;" 2>&1
    
    if [ $? -eq 0 ]; then
        echo "   ✅ Товары клиентов удалены успешно"
    else
        echo "   ❌ Ошибка при удалении товаров клиентов"
        exit 1
    fi
    
    echo "   Удаление товаров из каталога..."
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "DELETE FROM sima_land_catalog;" 2>&1
    
    if [ $? -eq 0 ]; then
        echo "   ✅ Каталог очищен успешно"
    else
        echo "   ❌ Ошибка при очистке каталога"
        exit 1
    fi
fi

echo ""

# Проверяем результат
echo "📊 Проверка результата..."

if [ "$CLEAR_CATALOG_ONLY" = true ]; then
    NEW_CATALOG_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM sima_land_catalog;" 2>/dev/null | tr -d ' ')
    
    if [ -z "$NEW_CATALOG_COUNT" ]; then
        NEW_CATALOG_COUNT=0
    fi
    
    if [ "$NEW_CATALOG_COUNT" -eq 0 ]; then
        echo "✅ Каталог успешно очищен. Товаров осталось: $NEW_CATALOG_COUNT"
    else
        echo "⚠️  В каталоге осталось товаров: $NEW_CATALOG_COUNT"
    fi
else
    NEW_PRODUCTS_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM sima_land_products;" 2>/dev/null | tr -d ' ')
    NEW_CATALOG_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM sima_land_catalog;" 2>/dev/null | tr -d ' ')
    
    if [ -z "$NEW_PRODUCTS_COUNT" ]; then
        NEW_PRODUCTS_COUNT=0
    fi
    if [ -z "$NEW_CATALOG_COUNT" ]; then
        NEW_CATALOG_COUNT=0
    fi
    
    if [ "$NEW_PRODUCTS_COUNT" -eq 0 ] && [ "$NEW_CATALOG_COUNT" -eq 0 ]; then
        echo "✅ База данных успешно очищена!"
        echo "   Товаров клиентов осталось: $NEW_PRODUCTS_COUNT"
        echo "   Товаров каталога осталось: $NEW_CATALOG_COUNT"
    else
        echo "⚠️  В базе данных остались товары:"
        echo "   Товаров клиентов: $NEW_PRODUCTS_COUNT"
        echo "   Товаров каталога: $NEW_CATALOG_COUNT"
    fi
fi

echo ""
echo "🎉 Операция завершена!"

