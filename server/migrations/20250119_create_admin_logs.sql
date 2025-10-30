-- Создание таблицы логов администратора
CREATE TABLE IF NOT EXISTS admin_logs (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создание индекса для быстрого поиска по администратору
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);

-- Создание индекса для быстрого поиска по действию
CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_logs(action);

-- Создание индекса для быстрого поиска по дате
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at);




