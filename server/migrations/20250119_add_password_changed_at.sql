-- Добавляем поле для отслеживания смены пароля
ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Обновляем существующих пользователей, устанавливая password_changed_at = created_at
UPDATE users SET password_changed_at = created_at WHERE password_changed_at IS NULL;




