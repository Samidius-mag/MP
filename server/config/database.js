const { Pool } = require('pg');

// Отладочная информация о переменных окружения
console.log('🔍 Database connection config:');
console.log('DB_HOST:', process.env.DB_HOST || 'localhost');
console.log('DB_PORT:', process.env.DB_PORT || 5432);
console.log('DB_NAME:', process.env.DB_NAME || 'dropshipping_db');
console.log('DB_USER:', process.env.DB_USER || 'dropshipping');
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***' : 'KeyOfWorld2025');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'dropshipping_db',
  user: process.env.DB_USER || 'dropshipping',
  password: process.env.DB_PASSWORD || 'KeyOfWorld2025',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Проверка подключения
const connectDB = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL database');
    
    // Создание таблиц при первом запуске
    await createTables();
    
    client.release();
  } catch (err) {
    console.error('❌ Database connection error:', err.message);
    process.exit(1);
  }
};

// Создание таблиц
const createTables = async () => {
  const client = await pool.connect();
  
  try {
    // Таблица пользователей
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'client',
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        phone VARCHAR(20),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица клиентов
    await client.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        company_name VARCHAR(255),
        inn VARCHAR(20),
        address TEXT,
        api_keys JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица депозитов
    await client.query(`
      CREATE TABLE IF NOT EXISTS deposits (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        amount DECIMAL(15,2) NOT NULL,
        balance_before DECIMAL(15,2) NOT NULL,
        balance_after DECIMAL(15,2) NOT NULL,
        transaction_type VARCHAR(50) NOT NULL, -- 'deposit', 'withdrawal', 'order_payment'
        description TEXT,
        payment_method VARCHAR(100),
        payment_id VARCHAR(255),
        status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'completed', 'failed'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица заказов
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        marketplace VARCHAR(50) NOT NULL, -- 'wildberries', 'ozon', 'yandex_market'
        marketplace_order_id VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'new', -- 'new', 'in_assembly', 'ready_to_ship', 'shipped', 'delivered', 'cancelled'
        total_amount DECIMAL(15,2) NOT NULL,
        commission_amount DECIMAL(15,2) DEFAULT 0,
        customer_name VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(20),
        customer_email VARCHAR(255),
        delivery_address TEXT NOT NULL,
        items JSONB NOT NULL DEFAULT '[]',
        tracking_number VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(marketplace, marketplace_order_id)
      )
    `);

    // Гарантируем наличие колонки order_type (для импорта WB/прочих)
    await client.query(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS order_type VARCHAR(10) DEFAULT 'FBS';
    `);

    // Индекс по типу заказа для быстрого фильтра
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders(order_type);
    `);

    // Таблица товаров в заказах
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        article VARCHAR(100) NOT NULL,
        name VARCHAR(500) NOT NULL,
        quantity INTEGER NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица стикеров
    await client.query(`
      CREATE TABLE IF NOT EXISTS stickers (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        sticker_data JSONB NOT NULL,
        printed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица уведомлений
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL, -- 'email', 'sms', 'internal'
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица настроек системы
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) UNIQUE NOT NULL,
        value JSONB NOT NULL,
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица логов сервера
    await client.query(`
      CREATE TABLE IF NOT EXISTS server_logs (
        id SERIAL PRIMARY KEY,
        level VARCHAR(20) NOT NULL, -- 'error', 'warn', 'info', 'debug'
        message TEXT NOT NULL,
        service VARCHAR(50), -- 'auth', 'orders', 'payment', etc.
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        ip_address INET,
        user_agent TEXT,
        request_id VARCHAR(100),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица логов клиента
    await client.query(`
      CREATE TABLE IF NOT EXISTS client_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        level VARCHAR(20) NOT NULL, -- 'error', 'warn', 'info', 'debug'
        message TEXT NOT NULL,
        component VARCHAR(100), -- React component name
        action VARCHAR(100), -- user action
        url VARCHAR(500),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица сессий пользователей (уже существует в auth.js, но добавим для полноты)
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        session_token VARCHAR(255) UNIQUE NOT NULL,
        remember_me BOOLEAN DEFAULT false,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица верификации (для email/phone codes)
    await client.query(`
      CREATE TABLE IF NOT EXISTS verification_codes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        code VARCHAR(10) NOT NULL,
        type VARCHAR(20) NOT NULL, -- 'email', 'phone', 'password_reset'
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Создание индексов
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(client_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_marketplace ON orders(marketplace);
      CREATE INDEX IF NOT EXISTS idx_deposits_client_id ON deposits(client_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_server_logs_level ON server_logs(level);
      CREATE INDEX IF NOT EXISTS idx_server_logs_created_at ON server_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_server_logs_user_id ON server_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_client_logs_user_id ON client_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_client_logs_level ON client_logs(level);
      CREATE INDEX IF NOT EXISTS idx_client_logs_created_at ON client_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_verification_codes_user_id ON verification_codes(user_id);
      CREATE INDEX IF NOT EXISTS idx_verification_codes_type ON verification_codes(type);
    `);

    // Миграция уникальности заказов: добавляем уникальность по (client_id, marketplace_order_id, marketplace)
    try {
      // 1) Удаляем возможные дубликаты под новую группу уникальности
      await client.query(`
        WITH duplicates AS (
          SELECT id,
                 ROW_NUMBER() OVER (
                   PARTITION BY client_id, marketplace, marketplace_order_id
                   ORDER BY id
                 ) AS rn
          FROM orders
        )
        DELETE FROM orders
        WHERE id IN (
          SELECT id FROM duplicates WHERE rn > 1
        );
      `);

      // 2) Создаём требуемый уникальный индекс под ON CONFLICT (client_id, marketplace_order_id, marketplace)
      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS orders_client_marketplace_unique
        ON orders (client_id, marketplace_order_id, marketplace);
      `);
    } catch (mErr) {
      console.error('❌ Migration error (orders unique index):', mErr.message);
    }

    console.log('✅ Database tables created successfully');
  } catch (err) {
    console.error('❌ Error creating tables:', err.message);
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  connectDB
};



