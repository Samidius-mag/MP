-- Миграция: 20250127_add_image_urls.sql
-- Добавляем поле для хранения массива изображений товара (JSONB)

ALTER TABLE sima_land_products
ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT NULL;

ALTER TABLE sima_land_catalog
ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT NULL;

-- Создаем GIN индексы для быстрого поиска по JSONB полям
CREATE INDEX IF NOT EXISTS idx_sima_land_products_image_urls ON sima_land_products USING GIN (image_urls);
CREATE INDEX IF NOT EXISTS idx_sima_land_catalog_image_urls ON sima_land_catalog USING GIN (image_urls);

COMMENT ON COLUMN sima_land_products.image_urls IS 'Массив URL всех изображений товара в формате JSONB';
COMMENT ON COLUMN sima_land_catalog.image_urls IS 'Массив URL всех изображений товара в формате JSONB';

