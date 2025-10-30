-- Простая миграция для добавления поля order_type
-- Дата: 2025-01-15

-- Добавляем поле order_type в таблицу orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type VARCHAR(10) DEFAULT 'FBS';

-- Обновляем существующие записи
UPDATE orders SET order_type = 'FBS' WHERE order_type IS NULL;

-- Добавляем комментарий к полю
COMMENT ON COLUMN orders.order_type IS 'Тип заказа: FBS, DBW, DBS';

-- Создаем индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders(order_type);

-- Проверяем, что колонка добавлена
SELECT 'order_type column added successfully' as status;












