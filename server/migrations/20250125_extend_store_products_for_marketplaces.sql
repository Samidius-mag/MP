-- Расширение таблицы товаров магазина для поддержки товаров из разных источников
-- и интеграции с маркетплейсами (WB, Ozon, Яндекс Маркет)
-- Миграция: 20250125_extend_store_products_for_marketplaces.sql

-- Удаляем уникальное ограничение на nm_id (товары из Сима Ленд не имеют nm_id)
ALTER TABLE wb_products_cache 
DROP CONSTRAINT IF EXISTS wb_products_cache_nm_id_key;

-- Делаем nm_id nullable (для товаров из Сима Ленд)
ALTER TABLE wb_products_cache 
ALTER COLUMN nm_id DROP NOT NULL;

-- Добавляем поле источника товара
ALTER TABLE wb_products_cache 
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'wildberries';

-- Создаем уникальный индекс по комбинации (client_id, article, source)
-- чтобы один товар не мог быть добавлен дважды из одного источника
CREATE UNIQUE INDEX IF NOT EXISTS idx_wb_products_cache_client_article_source 
ON wb_products_cache(client_id, article, source);

-- Создаем индекс на nm_id для быстрого поиска товаров WB
CREATE INDEX IF NOT EXISTS idx_wb_products_cache_nm_id 
ON wb_products_cache(nm_id) WHERE nm_id IS NOT NULL;

-- Добавляем поле закупочной цены (из Сима Ленд)
ALTER TABLE wb_products_cache 
ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(10,2);

-- Добавляем поле остатков из Сима Ленд
ALTER TABLE wb_products_cache 
ADD COLUMN IF NOT EXISTS available_quantity INTEGER DEFAULT 0;

-- Добавляем поле наценки в процентах
ALTER TABLE wb_products_cache 
ADD COLUMN IF NOT EXISTS markup_percent DECIMAL(5,2) DEFAULT 0.00;

-- Добавляем поле для хранения выбранных маркетплейсов (JSONB массив: ['wb', 'ozon', 'yandex_market'])
ALTER TABLE wb_products_cache 
ADD COLUMN IF NOT EXISTS marketplace_targets JSONB DEFAULT '[]'::jsonb;

-- Добавляем поле SKU на Яндекс Маркете
ALTER TABLE wb_products_cache 
ADD COLUMN IF NOT EXISTS yandex_market_sku VARCHAR(255);

-- Добавляем поле URL изображения товара
ALTER TABLE wb_products_cache 
ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);

-- Добавляем поле описания товара
ALTER TABLE wb_products_cache 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Добавляем поле категории ID на Яндекс Маркете
ALTER TABLE wb_products_cache 
ADD COLUMN IF NOT EXISTS yandex_market_category_id BIGINT;

-- Добавляем поле для хранения данных синхронизации с маркетплейсами
ALTER TABLE wb_products_cache 
ADD COLUMN IF NOT EXISTS marketplace_sync_status JSONB DEFAULT '{}'::jsonb;

-- Создаем индексы для новых полей
CREATE INDEX IF NOT EXISTS idx_wb_products_cache_source ON wb_products_cache(source);
CREATE INDEX IF NOT EXISTS idx_wb_products_cache_markup_percent ON wb_products_cache(markup_percent);
CREATE INDEX IF NOT EXISTS idx_wb_products_cache_yandex_market_sku ON wb_products_cache(yandex_market_sku);

-- Комментарии к новым полям
COMMENT ON COLUMN wb_products_cache.source IS 'Источник товара: wildberries, sima_land';
COMMENT ON COLUMN wb_products_cache.purchase_price IS 'Закупочная цена товара (из Сима Ленд)';
COMMENT ON COLUMN wb_products_cache.available_quantity IS 'Остаток товара на складе поставщика';
COMMENT ON COLUMN wb_products_cache.markup_percent IS 'Наценка в процентах от закупочной цены';
COMMENT ON COLUMN wb_products_cache.marketplace_targets IS 'Список маркетплейсов для загрузки: ["wb", "ozon", "yandex_market"]';
COMMENT ON COLUMN wb_products_cache.yandex_market_sku IS 'SKU товара на Яндекс Маркете';
COMMENT ON COLUMN wb_products_cache.marketplace_sync_status IS 'Статус синхронизации с маркетплейсами: {"yandex_market": {"synced": true, "last_sync": "2025-01-25T12:00:00Z"}}';

-- Обновляем существующие записи: устанавливаем source = 'wildberries' для всех существующих товаров
UPDATE wb_products_cache 
SET source = 'wildberries' 
WHERE source IS NULL;

