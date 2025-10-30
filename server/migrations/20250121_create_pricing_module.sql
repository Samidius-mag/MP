-- Создание модуля ценообразования для Wildberries
-- Миграция: 20250121_create_pricing_module.sql

-- Таблица настроек ценообразования клиентов
CREATE TABLE IF NOT EXISTS client_pricing_settings (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    marketplace VARCHAR(50) NOT NULL DEFAULT 'wildberries',
    
    -- Основные параметры ценообразования
    markup_percent DECIMAL(5,2) NOT NULL DEFAULT 10.00, -- Наценка в процентах
    acquiring_percent DECIMAL(5,2) NOT NULL DEFAULT 2.50, -- Эквайринг в процентах
    max_discount_percent DECIMAL(5,2) NOT NULL DEFAULT 20.00, -- Максимальная скидка
    
    -- Логистические параметры
    first_liter_logistics_rub DECIMAL(10,2) NOT NULL DEFAULT 0.00, -- Логистика первого литра
    additional_liter_logistics_rub DECIMAL(10,2) NOT NULL DEFAULT 0.00, -- Логистика дополнительного литра
    warehouse_coeff_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00, -- Коэффициент склада
    shipment_handling_rub DECIMAL(10,2) NOT NULL DEFAULT 0.00, -- Обработка отправления
    
    -- Ограничения по ценам
    min_purchase_price_rub DECIMAL(10,2) NOT NULL DEFAULT 0.00, -- Минимальная закупочная цена
    max_purchase_price_rub DECIMAL(10,2) NOT NULL DEFAULT 999999.99, -- Максимальная закупочная цена
    
    -- Дополнительные настройки
    below_rrp VARCHAR(20) NOT NULL DEFAULT 'unknown', -- Цены ниже РРЦ (unknown/yes/no)
    localization_index DECIMAL(5,2) NOT NULL DEFAULT 1.00, -- Индекс локализации
    
    -- Настройки автоматизации
    auto_pricing_enabled BOOLEAN NOT NULL DEFAULT false, -- Автоматическое ценообразование
    maintain_margin_in_promotions BOOLEAN NOT NULL DEFAULT true, -- Удерживать маржинальность в акциях
    auto_exit_promotions BOOLEAN NOT NULL DEFAULT true, -- Автоматически выходить из акций при нарушении маржинальности
    
    -- Временные метки
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(client_id, marketplace)
);

-- Таблица кэширования данных о товарах Wildberries
CREATE TABLE IF NOT EXISTS wb_products_cache (
    id SERIAL PRIMARY KEY,
    nm_id BIGINT NOT NULL, -- ID товара в Wildberries
    article VARCHAR(100) NOT NULL, -- Артикул поставщика
    name VARCHAR(500) NOT NULL, -- Наименование товара
    brand VARCHAR(100), -- Бренд
    category VARCHAR(100), -- Категория
    
    -- Габариты и вес для расчета логистики
    length_cm DECIMAL(8,2), -- Длина в см
    width_cm DECIMAL(8,2), -- Ширина в см
    height_cm DECIMAL(8,2), -- Высота в см
    weight_kg DECIMAL(8,3), -- Вес в кг
    volume_liters DECIMAL(8,3), -- Объем в литрах (вычисляется)
    
    -- Текущие цены и комиссии
    current_price DECIMAL(10,2), -- Текущая цена продажи
    commission_percent DECIMAL(5,2), -- Комиссия маркетплейса
    logistics_cost DECIMAL(10,2), -- Стоимость логистики
    
    -- Статус товара
    is_active BOOLEAN DEFAULT true, -- Активен ли товар
    in_promotion BOOLEAN DEFAULT false, -- Участвует в акции
    promotion_discount_percent DECIMAL(5,2) DEFAULT 0.00, -- Скидка в акции
    
    -- Временные метки
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(nm_id)
);

-- Таблица истории изменений цен
CREATE TABLE IF NOT EXISTS pricing_history (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nm_id BIGINT NOT NULL, -- ID товара в Wildberries
    article VARCHAR(100) NOT NULL, -- Артикул товара
    
    -- Цены
    old_price DECIMAL(10,2), -- Старая цена
    new_price DECIMAL(10,2), -- Новая цена
    calculated_price DECIMAL(10,2), -- Рассчитанная цена
    
    -- Параметры расчета
    markup_percent DECIMAL(5,2), -- Наценка
    acquiring_percent DECIMAL(5,2), -- Эквайринг
    logistics_cost DECIMAL(10,2), -- Логистика
    commission_percent DECIMAL(5,2), -- Комиссия WB
    margin_percent DECIMAL(5,2), -- Маржинальность
    
    -- Причина изменения
    change_reason VARCHAR(100) NOT NULL, -- Причина изменения (manual/auto/promotion_exit)
    change_source VARCHAR(50) NOT NULL DEFAULT 'system', -- Источник изменения (manual/system/api)
    
    -- Временные метки
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица настроек автоматизации ценообразования
CREATE TABLE IF NOT EXISTS pricing_automation_settings (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Настройки расписания
    check_interval_hours INTEGER NOT NULL DEFAULT 1, -- Интервал проверки в часах
    enabled BOOLEAN NOT NULL DEFAULT false, -- Включена ли автоматизация
    
    -- Настройки уведомлений
    notify_on_price_changes BOOLEAN NOT NULL DEFAULT true, -- Уведомлять об изменениях цен
    notify_on_margin_violations BOOLEAN NOT NULL DEFAULT true, -- Уведомлять о нарушениях маржинальности
    notify_email VARCHAR(255), -- Email для уведомлений
    
    -- Временные метки
    last_check TIMESTAMP, -- Последняя проверка
    next_check TIMESTAMP, -- Следующая проверка
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(client_id)
);

-- Таблица логов автоматизации
CREATE TABLE IF NOT EXISTS pricing_automation_logs (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Информация о запуске
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'running', -- running/completed/error
    
    -- Статистика
    products_checked INTEGER DEFAULT 0, -- Количество проверенных товаров
    prices_updated INTEGER DEFAULT 0, -- Количество обновленных цен
    promotions_exited INTEGER DEFAULT 0, -- Количество выходов из акций
    errors_count INTEGER DEFAULT 0, -- Количество ошибок
    
    -- Детали
    error_message TEXT, -- Сообщение об ошибке
    details JSONB -- Дополнительные детали в JSON
);

-- Создание индексов для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_client_pricing_settings_client_id ON client_pricing_settings(client_id);
CREATE INDEX IF NOT EXISTS idx_wb_products_cache_nm_id ON wb_products_cache(nm_id);
CREATE INDEX IF NOT EXISTS idx_wb_products_cache_article ON wb_products_cache(article);
CREATE INDEX IF NOT EXISTS idx_wb_products_cache_last_updated ON wb_products_cache(last_updated);
CREATE INDEX IF NOT EXISTS idx_pricing_history_client_id ON pricing_history(client_id);
CREATE INDEX IF NOT EXISTS idx_pricing_history_nm_id ON pricing_history(nm_id);
CREATE INDEX IF NOT EXISTS idx_pricing_history_changed_at ON pricing_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_pricing_automation_settings_client_id ON pricing_automation_settings(client_id);
CREATE INDEX IF NOT EXISTS idx_pricing_automation_logs_client_id ON pricing_automation_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_pricing_automation_logs_started_at ON pricing_automation_logs(started_at);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггеры для автоматического обновления updated_at
CREATE TRIGGER update_client_pricing_settings_updated_at 
    BEFORE UPDATE ON client_pricing_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pricing_automation_settings_updated_at 
    BEFORE UPDATE ON pricing_automation_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Функция для вычисления объема товара
CREATE OR REPLACE FUNCTION calculate_volume_liters()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.length_cm IS NOT NULL AND NEW.width_cm IS NOT NULL AND NEW.height_cm IS NOT NULL THEN
        NEW.volume_liters = (NEW.length_cm * NEW.width_cm * NEW.height_cm) / 1000.0;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггер для автоматического вычисления объема
CREATE TRIGGER calculate_volume_trigger
    BEFORE INSERT OR UPDATE ON wb_products_cache
    FOR EACH ROW EXECUTE FUNCTION calculate_volume_liters();
