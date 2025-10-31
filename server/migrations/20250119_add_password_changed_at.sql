-- Добавляем поле для отслеживания смены пароля (идемпотентно)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Обновляем существующих пользователей, устанавливая password_changed_at = created_at
UPDATE users SET password_changed_at = created_at WHERE password_changed_at IS NULL;




