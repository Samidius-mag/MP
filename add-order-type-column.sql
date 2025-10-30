-- Простой SQL скрипт для добавления колонки order_type
-- Выполните этот скрипт в вашей базе данных

-- Добавляем колонку order_type
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type VARCHAR(10) DEFAULT 'FBS';

-- Обновляем существующие записи
UPDATE orders SET order_type = 'FBS' WHERE order_type IS NULL;

-- Проверяем результат
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'orders' AND column_name = 'order_type';












