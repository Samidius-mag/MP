-- Warehouse module tables
CREATE TABLE IF NOT EXISTS warehouse_items (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  barcode VARCHAR(64) UNIQUE,
  purchase_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_warehouse_items_client ON warehouse_items(client_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_items_barcode ON warehouse_items(barcode);

CREATE TABLE IF NOT EXISTS warehouse_transactions (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL, -- 'in' | 'out' | 'adjust'
  quantity INTEGER NOT NULL,
  note TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_warehouse_tx_client ON warehouse_transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_tx_item ON warehouse_transactions(item_id);




