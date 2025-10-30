-- Создание таблиц для прайс-листа и остатков товаров
-- Миграция: 20250120_create_price_list_and_inventory.sql

-- Таблица прайс-листа товаров
CREATE TABLE IF NOT EXISTS price_list (
    id SERIAL PRIMARY KEY,
    article VARCHAR(100) NOT NULL,
    name VARCHAR(500) NOT NULL,
    purchase_price DECIMAL(10,2) NOT NULL, -- Закупочная цена
    selling_price DECIMAL(10,2) NOT NULL,  -- Цена продажи
    markup_percent DECIMAL(5,2) DEFAULT 0, -- Наценка в процентах
    category VARCHAR(100),
    brand VARCHAR(100),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(article)
);

-- Таблица остатков товаров на складе поставщика
CREATE TABLE IF NOT EXISTS inventory (
    id SERIAL PRIMARY KEY,
    article VARCHAR(100) NOT NULL REFERENCES price_list(article) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0, -- Количество на складе
    reserved_quantity INTEGER DEFAULT 0, -- Зарезервированное количество
    available_quantity INTEGER GENERATED ALWAYS AS (quantity - reserved_quantity) STORED, -- Доступное количество
    warehouse_location VARCHAR(100), -- Местоположение на складе
    last_updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Кто последний обновил
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(article)
);

-- Таблица истории изменений остатков
CREATE TABLE IF NOT EXISTS inventory_history (
    id SERIAL PRIMARY KEY,
    article VARCHAR(100) NOT NULL,
    old_quantity INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    change_type VARCHAR(50) NOT NULL, -- 'manual', 'api', 'order', 'return', 'import'
    change_reason TEXT,
    changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица платежных поручений для пополнения депозита
CREATE TABLE IF NOT EXISTS payment_orders (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    deposit_id INTEGER NOT NULL REFERENCES deposits(id) ON DELETE CASCADE,
    amount DECIMAL(15,2) NOT NULL,
    bank_account VARCHAR(50) NOT NULL, -- Счет получателя
    bank_name VARCHAR(255) NOT NULL,   -- Наименование банка
    bank_bik VARCHAR(20) NOT NULL,     -- БИК банка
    purpose VARCHAR(500) NOT NULL,     -- Назначение платежа
    payment_order_file_path VARCHAR(500), -- Путь к загруженному файлу
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'verified', 'rejected'
    verified_at TIMESTAMP,
    verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица возвратов товаров
CREATE TABLE IF NOT EXISTS product_returns (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    article VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL,
    return_reason VARCHAR(100), -- 'defect', 'wrong_item', 'customer_request', etc.
    return_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'processed'
    refund_amount DECIMAL(10,2) NOT NULL, -- Сумма к возврату
    processed_at TIMESTAMP,
    processed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создание индексов для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_price_list_article ON price_list(article);
CREATE INDEX IF NOT EXISTS idx_price_list_category ON price_list(category);
CREATE INDEX IF NOT EXISTS idx_price_list_brand ON price_list(brand);
CREATE INDEX IF NOT EXISTS idx_price_list_is_active ON price_list(is_active);

CREATE INDEX IF NOT EXISTS idx_inventory_article ON inventory(article);
CREATE INDEX IF NOT EXISTS idx_inventory_quantity ON inventory(quantity);
CREATE INDEX IF NOT EXISTS idx_inventory_last_updated_by ON inventory(last_updated_by);

CREATE INDEX IF NOT EXISTS idx_inventory_history_article ON inventory_history(article);
CREATE INDEX IF NOT EXISTS idx_inventory_history_changed_by ON inventory_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_inventory_history_created_at ON inventory_history(created_at);

CREATE INDEX IF NOT EXISTS idx_payment_orders_client_id ON payment_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_deposit_id ON payment_orders(deposit_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status);

CREATE INDEX IF NOT EXISTS idx_product_returns_order_id ON product_returns(order_id);
CREATE INDEX IF NOT EXISTS idx_product_returns_article ON product_returns(article);
CREATE INDEX IF NOT EXISTS idx_product_returns_status ON product_returns(return_status);

-- Добавление триггера для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Применение триггера к таблицам
DROP TRIGGER IF EXISTS update_price_list_updated_at ON price_list;
CREATE TRIGGER update_price_list_updated_at
    BEFORE UPDATE ON price_list
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventory_updated_at ON inventory;
CREATE TRIGGER update_inventory_updated_at
    BEFORE UPDATE ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Функция для автоматического создания записи в inventory при добавлении товара в price_list
CREATE OR REPLACE FUNCTION create_inventory_record()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO inventory (article, quantity, last_updated_by)
    VALUES (NEW.article, 0, NULL)
    ON CONFLICT (article) DO NOTHING;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггер для автоматического создания записи остатков
DROP TRIGGER IF EXISTS create_inventory_on_price_list_insert ON price_list;
CREATE TRIGGER create_inventory_on_price_list_insert
    AFTER INSERT ON price_list
    FOR EACH ROW
    EXECUTE FUNCTION create_inventory_record();

-- Функция для логирования изменений остатков
CREATE OR REPLACE FUNCTION log_inventory_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.quantity != NEW.quantity THEN
        INSERT INTO inventory_history (article, old_quantity, new_quantity, change_type, changed_by)
        VALUES (OLD.article, OLD.quantity, NEW.quantity, 'manual', NEW.last_updated_by);
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггер для логирования изменений остатков
DROP TRIGGER IF EXISTS log_inventory_changes ON inventory;
CREATE TRIGGER log_inventory_changes
    AFTER UPDATE ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION log_inventory_change();


