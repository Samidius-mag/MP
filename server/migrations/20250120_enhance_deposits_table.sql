-- Улучшение таблицы депозитов для поддержки PDF счетов
-- Миграция: 20250120_enhance_deposits_table.sql

-- Добавление колонок для PDF счетов
ALTER TABLE deposits 
ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS invoice_file_path VARCHAR(500),
ADD COLUMN IF NOT EXISTS payment_order_file_path VARCHAR(500),
ADD COLUMN IF NOT EXISTS bank_verification_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'verified', 'rejected'
ADD COLUMN IF NOT EXISTS bank_verification_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS bank_verification_notes TEXT;

-- Создание индекса для поиска по номеру счета
CREATE INDEX IF NOT EXISTS idx_deposits_invoice_number ON deposits(invoice_number);

-- Создание индекса для поиска по статусу верификации банка
CREATE INDEX IF NOT EXISTS idx_deposits_bank_verification_status ON deposits(bank_verification_status);


