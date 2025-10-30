-- Миграция для улучшенной системы регистрации и авторизации
-- Добавляем поля для верификации email и телефона
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS email_verification_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP,
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS phone_verification_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS phone_verification_expires TIMESTAMP,
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(255),
ADD COLUMN IF NOT EXISTS remember_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS remember_token_expires TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP,
ADD COLUMN IF NOT EXISTS session_expires TIMESTAMP;

-- Обновляем таблицу clients для новых полей компании
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS company_form VARCHAR(10), -- 'IP' или 'OOO'
ADD COLUMN IF NOT EXISTS inn VARCHAR(12),
ADD COLUMN IF NOT EXISTS ogrn VARCHAR(15),
ADD COLUMN IF NOT EXISTS fns_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS fns_verification_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS terms_accepted_date TIMESTAMP;

-- Создаем таблицу для кодов верификации
CREATE TABLE IF NOT EXISTS verification_codes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL, -- 'email' или 'phone'
  code VARCHAR(10) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создаем таблицу для сессий пользователей
CREATE TABLE IF NOT EXISTS user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  remember_me BOOLEAN DEFAULT false,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создаем индексы для производительности
CREATE INDEX IF NOT EXISTS idx_users_email_verification ON users(email_verification_code);
CREATE INDEX IF NOT EXISTS idx_users_phone_verification ON users(phone_verification_code);
CREATE INDEX IF NOT EXISTS idx_verification_codes_user_type ON verification_codes(user_id, type);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);

UPDATE users SET 
  email_verified = true,
  phone_verified = true
WHERE email_verified IS NULL;

-- Устанавливаем принятие оферты для существующих клиентов
UPDATE clients SET 
  terms_accepted = true,
  terms_accepted_date = NOW()
WHERE terms_accepted IS NULL;
