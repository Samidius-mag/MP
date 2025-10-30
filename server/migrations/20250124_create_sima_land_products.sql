-- Создание таблицы для товаров СИМА ЛЕНД
-- Таблица хранит товары поставщика, которые клиент может добавлять в свой магазин

CREATE TABLE IF NOT EXISTS sima_land_products (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  article VARCHAR(100) NOT NULL,
  name VARCHAR(500) NOT NULL,
  brand VARCHAR(100),
  category VARCHAR(100),
  purchase_price DECIMAL(10,2),
  available_quantity INTEGER DEFAULT 0,
  image_url VARCHAR(500),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id, article)
);

-- Создаем индексы для производительности
CREATE INDEX IF NOT EXISTS idx_sima_land_products_client ON sima_land_products(client_id);
CREATE INDEX IF NOT EXISTS idx_sima_land_products_article ON sima_land_products(article);
CREATE INDEX IF NOT EXISTS idx_sima_land_products_brand ON sima_land_products(brand);
CREATE INDEX IF NOT EXISTS idx_sima_land_products_category ON sima_land_products(category);

-- Комментарии к таблице
COMMENT ON TABLE sima_land_products IS 'Товары поставщика СИМА ЛЕНД, доступные для добавления в каталог клиента';
COMMENT ON COLUMN sima_land_products.client_id IS 'ID клиента';
COMMENT ON COLUMN sima_land_products.article IS 'Артикул товара';
COMMENT ON COLUMN sima_land_products.name IS 'Название товара';
COMMENT ON COLUMN sima_land_products.brand IS 'Бренд товара';
COMMENT ON COLUMN sima_land_products.category IS 'Категория товара';
COMMENT ON COLUMN sima_land_products.purchase_price IS 'Цена закупки';
COMMENT ON COLUMN sima_land_products.available_quantity IS 'Доступное количество на складе';
COMMENT ON COLUMN sima_land_products.image_url IS 'URL изображения товара';
COMMENT ON COLUMN sima_land_products.description IS 'Описание товара';

