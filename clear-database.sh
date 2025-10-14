#!/usr/bin/env bash

set -euo pipefail

echo "========================================"
echo "  Очистка базы данных дропшиппинга"
echo "========================================"

# Поиск файла окружения
ENV_FILE=""
if [ -f ".env" ]; then
  ENV_FILE=".env"
elif [ -f "/root/MP/.env" ]; then
  ENV_FILE="/root/MP/.env"
elif [ -f "/var/www/dropshipping/.env" ]; then
  ENV_FILE="/var/www/dropshipping/.env"
fi

if [ -n "$ENV_FILE" ]; then
  echo "🔧 Загружаю переменные из $ENV_FILE"
  # shellcheck disable=SC2046
  export $(grep -E '^(DB_HOST|DB_PORT|DB_NAME|DB_USER|DB_PASSWORD)=' "$ENV_FILE" | xargs -d '\n') || true
fi

# Значения по умолчанию
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-dropshipping_db}
DB_USER=${DB_USER:-dropshipping}
DB_PASSWORD=${DB_PASSWORD:-KeyOfWorld2025}

echo "База: $DB_NAME" 
echo "Хост: $DB_HOST:$DB_PORT"
echo "Пользователь: $DB_USER"

read -r -p "⚠ Это безвозвратно удалит все данные. Введите YES для продолжения: " CONFIRM
if [ "$CONFIRM" != "YES" ]; then
  echo "❌ Операция отменена"
  exit 0
fi

export PGPASSWORD="$DB_PASSWORD"

echo "🔍 Проверка подключения..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null
echo "✅ Подключение успешно"

echo "🗑 Удаляю данные и сбрасываю идентификаторы..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
-- Используем TRUNCATE ... RESTART IDENTITY CASCADE, чтобы корректно очистить со связями и сбросить последовательности
TRUNCATE TABLE
  order_items,
  stickers,
  orders,
  deposits,
  notifications,
  system_settings,
  clients,
  users
RESTART IDENTITY CASCADE;
COMMIT;
SQL

echo "✅ База данных очищена (все таблицы, последовательности сброшены)"
echo ""
echo "Готово."




