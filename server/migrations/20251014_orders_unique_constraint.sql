-- Ensure orders uniqueness matches application ON CONFLICT target
-- 1) Remove duplicates under (client_id, marketplace, marketplace_order_id)
WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY client_id, marketplace, marketplace_order_id
           ORDER BY id
         ) AS rn
  FROM orders
)
DELETE FROM orders
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- 2) Drop old unique constraint if it exists (marketplace, marketplace_order_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'orders'
      AND c.conname = 'orders_marketplace_marketplace_order_id_key'
  ) THEN
    ALTER TABLE orders DROP CONSTRAINT orders_marketplace_marketplace_order_id_key;
  END IF;
END $$;

-- 3) Create new unique constraint for (client_id, marketplace_order_id, marketplace)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'orders'
      AND c.conname = 'orders_client_marketplace_unique'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_client_marketplace_unique
      UNIQUE (client_id, marketplace_order_id, marketplace);
  END IF;
END $$;

-- 4) Helpful indexes
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_marketplace ON orders(marketplace);


