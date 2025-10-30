-- Добавление поля client_id в таблицу wb_products_cache
-- для привязки товаров к конкретным клиентам

-- Добавляем поле client_id
ALTER TABLE wb_products_cache 
ADD COLUMN IF NOT EXISTS client_id INTEGER;

-- Создаем индекс для оптимизации запросов по client_id
CREATE INDEX IF NOT EXISTS idx_wb_products_cache_client_id ON wb_products_cache(client_id);

-- Обновляем существующие записи (если есть)
-- Устанавливаем client_id = 1 для всех существующих записей
-- В реальном проекте нужно будет более аккуратно распределить товары по клиентам
UPDATE wb_products_cache 
SET client_id = 1 
WHERE client_id IS NULL;

-- Делаем поле client_id обязательным
ALTER TABLE wb_products_cache 
ALTER COLUMN client_id SET NOT NULL;

-- Добавляем внешний ключ на таблицу clients
ALTER TABLE wb_products_cache 
ADD CONSTRAINT fk_wb_products_cache_client_id 
FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;


