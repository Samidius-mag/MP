-- Создание таблицы для товаров Южных Ворот (ЮВ)
-- Таблица хранит товары, добавленные вручную операторами
-- Миграция: 20250126_create_yv_products.sql

CREATE TABLE IF NOT EXISTS yv_products (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  operator_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Оператор, который добавил товар
  
  -- Основная информация
  article VARCHAR(100) NOT NULL, -- Артикул (автогенерируется, проверка уникальности по всем поставщикам)
  name VARCHAR(500) NOT NULL, -- Название товара
  description TEXT, -- Описание (можно автогенерировать по названию)
  
  -- Цены (3 вида)
  purchase_price DECIMAL(10,2), -- 1. Цена закупки (видят только операторы)
  seller_price DECIMAL(10,2), -- 2. Цена продажи селлеру (видят операторы и клиенты)
  marketplace_price DECIMAL(10,2), -- 3. Цена продажи на МП (видят операторы и клиенты)
  fulfillment_price DECIMAL(10,2), -- Цена услуг фулфилмента (будет согласовываться)
  
  -- Изображения
  images JSONB DEFAULT '[]'::jsonb, -- Массив URL изображений (без потери качества)
  main_image_url VARCHAR(500), -- Главное изображение
  
  -- Штрихкоды
  barcode VARCHAR(255), -- Штрихкод для передачи на МП
  sku VARCHAR(255), -- SKU для передачи на МП
  
  -- Остатки
  stock_quantity INTEGER DEFAULT 0, -- Остаток (заполняется оператором, актуализируется вручную)
  
  -- Габариты упаковки
  package_length_cm DECIMAL(8,2), -- Длина упаковки (Д)
  package_width_cm DECIMAL(8,2), -- Ширина упаковки (Ш)
  package_height_cm DECIMAL(8,2), -- Высота упаковки (В)
  package_weight_kg DECIMAL(8,3), -- Вес упаковки в кг
  
  -- Дополнительные поля
  brand VARCHAR(100), -- Бренд
  category VARCHAR(100), -- Категория
  
  -- Статус синхронизации с МП
  mp_sync_status JSONB DEFAULT '{}'::jsonb, -- Статус синхронизации: {"wb": {"synced": false}, "ozon": {"synced": false}, "yandex_market": {"synced": false}}
  mp_product_ids JSONB DEFAULT '{}'::jsonb, -- ID товаров на МП: {"wb": null, "ozon": null, "yandex_market": null}
  
  -- Метаданные
  is_active BOOLEAN DEFAULT true, -- Активен ли товар
  is_approved BOOLEAN DEFAULT false, -- Прошел ли модерацию на МП
  
  -- Временные метки
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Уникальность артикула по клиенту (один клиент не может иметь два товара с одинаковым артикулом)
  UNIQUE(client_id, article)
);

-- Создаем индексы для производительности
CREATE INDEX IF NOT EXISTS idx_yv_products_client ON yv_products(client_id);
CREATE INDEX IF NOT EXISTS idx_yv_products_article ON yv_products(article);
CREATE INDEX IF NOT EXISTS idx_yv_products_operator ON yv_products(operator_id);
CREATE INDEX IF NOT EXISTS idx_yv_products_barcode ON yv_products(barcode);
CREATE INDEX IF NOT EXISTS idx_yv_products_sku ON yv_products(sku);
CREATE INDEX IF NOT EXISTS idx_yv_products_active ON yv_products(is_active);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_yv_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER trigger_update_yv_products_updated_at
  BEFORE UPDATE ON yv_products
  FOR EACH ROW
  EXECUTE FUNCTION update_yv_products_updated_at();

-- Комментарии к таблице и полям
COMMENT ON TABLE yv_products IS 'Товары Южных Ворот, добавленные вручную операторами';
COMMENT ON COLUMN yv_products.client_id IS 'ID клиента';
COMMENT ON COLUMN yv_products.operator_id IS 'ID оператора, который добавил товар';
COMMENT ON COLUMN yv_products.article IS 'Артикул товара (автогенерируется, уникальный для клиента)';
COMMENT ON COLUMN yv_products.name IS 'Название товара';
COMMENT ON COLUMN yv_products.description IS 'Описание товара (можно автогенерировать по названию)';
COMMENT ON COLUMN yv_products.purchase_price IS 'Цена закупки (видят только операторы)';
COMMENT ON COLUMN yv_products.seller_price IS 'Цена продажи селлеру (видят операторы и клиенты)';
COMMENT ON COLUMN yv_products.marketplace_price IS 'Цена продажи на МП (видят операторы и клиенты)';
COMMENT ON COLUMN yv_products.fulfillment_price IS 'Цена услуг фулфилмента';
COMMENT ON COLUMN yv_products.images IS 'Массив URL изображений товара (JSONB)';
COMMENT ON COLUMN yv_products.barcode IS 'Штрихкод для передачи на МП';
COMMENT ON COLUMN yv_products.sku IS 'SKU для передачи на МП';
COMMENT ON COLUMN yv_products.stock_quantity IS 'Остаток товара (заполняется оператором)';
COMMENT ON COLUMN yv_products.package_length_cm IS 'Длина упаковки в см';
COMMENT ON COLUMN yv_products.package_width_cm IS 'Ширина упаковки в см';
COMMENT ON COLUMN yv_products.package_height_cm IS 'Высота упаковки в см';
COMMENT ON COLUMN yv_products.mp_sync_status IS 'Статус синхронизации с маркетплейсами';
COMMENT ON COLUMN yv_products.mp_product_ids IS 'ID товаров на маркетплейсах';

