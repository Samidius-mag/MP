# Инструкция по выполнению миграции для добавления поля order_type

## Проблема
При импорте заказов возникает ошибка: `column "order_type" of relation "orders" does not exist`

## Решение
Необходимо выполнить миграцию базы данных для добавления поля `order_type` в таблицу `orders`.

## Способы выполнения миграции

### Способ 1: Через bat-файл (рекомендуется)
```bash
./add-order-type-migration.bat
```

### Способ 2: Через Node.js скрипт
```bash
cd server
node scripts/run-migrations.js
```

### Способ 3: Ручное выполнение SQL
Подключитесь к базе данных и выполните команды из файла `migrate-order-type.sql`:

```sql
-- Добавляем поле order_type в таблицу orders
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS order_type VARCHAR(10) DEFAULT 'FBS';

-- Добавляем комментарий к полю
COMMENT ON COLUMN orders.order_type IS 'Тип заказа: DBS (Доставка со склада WB), DBW (Доставка курьером WB), FBS (Доставка продавцом)';

-- Обновляем существующие записи, устанавливая FBS по умолчанию
UPDATE orders 
SET order_type = 'FBS' 
WHERE order_type IS NULL;

-- Создаем индекс для быстрого поиска по типу заказа
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders(order_type);

-- Создаем составной индекс для поиска по клиенту и типу заказа
CREATE INDEX IF NOT EXISTS idx_orders_client_order_type ON orders(client_id, order_type);
```

### Способ 4: Через Docker (если сервер запущен в Docker)
```bash
docker exec -it dropshipping-server node scripts/run-migrations.js
```

## Проверка выполнения миграции
После выполнения миграции проверьте, что поле добавлено:

```sql
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'orders' AND column_name = 'order_type';
```

Должен вернуться результат с полем `order_type`.

## После выполнения миграции
1. Перезапустите сервер
2. Попробуйте импортировать заказы снова
3. Проверьте, что заказы отображаются с типами (FBS, DBW, DBS)

## Файлы миграции
- `server/migrations/20250115_add_order_type.sql` - основная миграция
- `migrate-order-type.sql` - SQL команды для ручного выполнения
- `add-order-type-migration.bat` - bat-файл для удобного запуска

