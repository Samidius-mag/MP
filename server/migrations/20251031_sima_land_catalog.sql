-- Shared Sima Land catalog and categories

CREATE TABLE IF NOT EXISTS sima_land_categories (
  id BIGINT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  parent_id BIGINT,
  level INT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sima_land_catalog (
  id BIGINT PRIMARY KEY, -- Sima Land item id
  article VARCHAR(64),
  name TEXT NOT NULL,
  brand VARCHAR(255),
  category_id BIGINT,
  category VARCHAR(255),
  purchase_price NUMERIC(12,2),
  available_quantity INT,
  image_url TEXT,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sima_catalog_category ON sima_land_catalog(category_id);
CREATE INDEX IF NOT EXISTS idx_sima_catalog_article ON sima_land_catalog(article);


