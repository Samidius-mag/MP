-- Миграция для добавления поля order_type в таблицу orders
-- Дата: 2025-01-15

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