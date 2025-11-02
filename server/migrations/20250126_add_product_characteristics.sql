-- Миграция: Добавление поля для хранения характеристик товаров
-- 20250126_add_product_characteristics.sql

-- Добавляем поле characteristics в wb_products_cache для хранения характеристик товара (цвет, размер, параметры)
ALTER TABLE wb_products_cache 
ADD COLUMN IF NOT EXISTS characteristics JSONB DEFAULT '{}'::jsonb;

-- Добавляем поле characteristics в sima_land_products
ALTER TABLE sima_land_products 
ADD COLUMN IF NOT EXISTS characteristics JSONB DEFAULT '{}'::jsonb;

-- Добавляем поле characteristics в sima_land_catalog
ALTER TABLE sima_land_catalog 
ADD COLUMN IF NOT EXISTS characteristics JSONB DEFAULT '{}'::jsonb;

-- Создаем GIN индекс для быстрого поиска по характеристикам
CREATE INDEX IF NOT EXISTS idx_wb_products_cache_characteristics ON wb_products_cache USING GIN (characteristics);
CREATE INDEX IF NOT EXISTS idx_sima_land_products_characteristics ON sima_land_products USING GIN (characteristics);
CREATE INDEX IF NOT EXISTS idx_sima_land_catalog_characteristics ON sima_land_catalog USING GIN (characteristics);

-- Комментарии к полям
COMMENT ON COLUMN wb_products_cache.characteristics IS 'Характеристики товара в формате JSON: {"color": "Красный", "size": "M", "material": "Хлопок", "parameters": [...]}';
COMMENT ON COLUMN sima_land_products.characteristics IS 'Характеристики товара из Sima Land API';
COMMENT ON COLUMN sima_land_catalog.characteristics IS 'Характеристики товара из общего каталога Sima Land';

