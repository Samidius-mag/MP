# 📊 Модуль ценообразования Wildberries - Документация

## 🎯 Обзор

Модуль ценообразования обеспечивает автоматическое управление ценами на маркетплейсе Wildberries с учетом:
- Наценки и маржинальности
- Эквайринга (по умолчанию 2.5%)
- Логистических затрат (на основе габаритов товаров)
- Комиссий маркетплейса (получается через API)
- Участия в акциях с контролем маржинальности

## 🗄️ Структура базы данных

### Новые таблицы:

#### 1. `client_pricing_settings` - Настройки ценообразования клиентов
```sql
- id (SERIAL PRIMARY KEY)
- client_id (INTEGER) - ID клиента
- marketplace (VARCHAR) - Маркетплейс (wildberries)
- markup_percent (DECIMAL) - Наценка в процентах
- acquiring_percent (DECIMAL) - Эквайринг в процентах
- max_discount_percent (DECIMAL) - Максимальная скидка
- first_liter_logistics_rub (DECIMAL) - Логистика первого литра
- additional_liter_logistics_rub (DECIMAL) - Логистика дополнительного литра
- warehouse_coeff_percent (DECIMAL) - Коэффициент склада
- shipment_handling_rub (DECIMAL) - Обработка отправления
- min_purchase_price_rub (DECIMAL) - Минимальная закупочная цена
- max_purchase_price_rub (DECIMAL) - Максимальная закупочная цена
- below_rrp (VARCHAR) - Цены ниже РРЦ
- localization_index (DECIMAL) - Индекс локализации
- maintain_margin_in_promotions (BOOLEAN) - Удерживать маржинальность в акциях
- auto_exit_promotions (BOOLEAN) - Автоматически выходить из акций
- created_at, updated_at (TIMESTAMP)
```

#### 2. `wb_products_cache` - Кэш товаров Wildberries
```sql
- id (SERIAL PRIMARY KEY)
- nm_id (BIGINT UNIQUE) - ID товара в Wildberries
- article (VARCHAR) - Артикул поставщика
- name (VARCHAR) - Наименование товара
- brand (VARCHAR) - Бренд
- category (VARCHAR) - Категория
- length_cm, width_cm, height_cm (DECIMAL) - Габариты
- weight_kg (DECIMAL) - Вес
- volume_liters (DECIMAL) - Объем (вычисляется)
- current_price (DECIMAL) - Текущая цена
- commission_percent (DECIMAL) - Комиссия маркетплейса
- logistics_cost (DECIMAL) - Стоимость логистики
- is_active (BOOLEAN) - Активен ли товар
- in_promotion (BOOLEAN) - Участвует в акции
- promotion_discount_percent (DECIMAL) - Скидка в акции
- last_updated, created_at (TIMESTAMP)
```

#### 3. `pricing_history` - История изменений цен
```sql
- id (SERIAL PRIMARY KEY)
- client_id (INTEGER) - ID клиента
- nm_id (BIGINT) - ID товара в Wildberries
- article (VARCHAR) - Артикул товара
- old_price, new_price, calculated_price (DECIMAL) - Цены
- markup_percent, acquiring_percent (DECIMAL) - Параметры расчета
- logistics_cost, commission_percent (DECIMAL) - Затраты
- margin_percent (DECIMAL) - Маржинальность
- change_reason (VARCHAR) - Причина изменения
- change_source (VARCHAR) - Источник изменения
- changed_at (TIMESTAMP)
```

#### 4. `pricing_automation_settings` - Настройки автоматизации
```sql
- id (SERIAL PRIMARY KEY)
- client_id (INTEGER) - ID клиента
- check_interval_hours (INTEGER) - Интервал проверки
- enabled (BOOLEAN) - Включена ли автоматизация
- notify_on_price_changes (BOOLEAN) - Уведомлять об изменениях цен
- notify_on_margin_violations (BOOLEAN) - Уведомлять о нарушениях маржинальности
- notify_email (VARCHAR) - Email для уведомлений
- last_check, next_check (TIMESTAMP) - Времена проверок
- created_at, updated_at (TIMESTAMP)
```

#### 5. `pricing_automation_logs` - Логи автоматизации
```sql
- id (SERIAL PRIMARY KEY)
- client_id (INTEGER) - ID клиента
- started_at, finished_at (TIMESTAMP) - Время выполнения
- status (VARCHAR) - Статус (running/completed/error)
- products_checked (INTEGER) - Количество проверенных товаров
- prices_updated (INTEGER) - Количество обновленных цен
- promotions_exited (INTEGER) - Количество выходов из акций
- errors_count (INTEGER) - Количество ошибок
- error_message (TEXT) - Сообщение об ошибке
- details (JSONB) - Дополнительные детали
```

## 🔧 API Endpoints

### Настройки ценообразования
- `GET /api/pricing/settings` - Получить настройки
- `PUT /api/pricing/settings` - Обновить настройки

### Товары
- `GET /api/pricing/products` - Получить товары клиента
- `POST /api/pricing/sync-products` - Синхронизировать с Wildberries

### Расчет цен
- `POST /api/pricing/calculate-price` - Рассчитать цену для товара
- `GET /api/pricing/check-updates` - Проверить необходимость обновления цен
- `POST /api/pricing/update-price` - Обновить цену товара
- `POST /api/pricing/exit-promotion` - Выйти из акции

### Автоматизация
- `GET /api/pricing/automation/status` - Статус автоматизации
- `POST /api/pricing/automation/enable` - Включить автоматизацию
- `POST /api/pricing/automation/disable` - Отключить автоматизацию
- `POST /api/pricing/automation/run-check` - Запустить ручную проверку

### Статистика и история
- `GET /api/pricing/statistics` - Статистика ценообразования
- `GET /api/pricing/history` - История изменений цен

## 🚀 Сервисы

### 1. WildberriesPricingService
- Интеграция с API Wildberries
- Получение данных о товарах и ценах
- Обновление цен на маркетплейсе
- Управление участием в акциях

### 2. PricingCalculationService
- Расчет оптимальных цен
- Проверка необходимости обновления
- Логирование изменений
- Статистика ценообразования

### 3. PricingAutomationService
- Автоматический мониторинг цен
- Периодические задачи (каждый час)
- Управление автоматизацией
- Логирование выполнения

## 📱 Интерфейс

### Основные функции:
1. **Настройка параметров ценообразования**
   - Наценка и маржинальность
   - Эквайринг (по умолчанию 2.5%)
   - Логистические параметры
   - Ограничения по ценам
   - Настройки акций

2. **Синхронизация товаров**
   - Получение данных с Wildberries
   - Кэширование характеристик товаров
   - Обновление информации о ценах

3. **Расчет и корректировка цен**
   - Интерактивный расчет цен
   - Рекомендации по корректировке
   - Управление участием в акциях

4. **Автоматизация**
   - Включение/отключение автоматизации
   - Настройка интервалов проверки
   - Уведомления о изменениях

## 🔄 Алгоритм работы

### 1. Расчет цены
```
Цена = (Закупочная_цена + Логистика + Комиссия_WB + Эквайринг) × (1 + Наценка%)
```

### 2. Проверка акций
- Если товар в акции и включено "Удерживать маржинальность":
  - Пересчитываем цену для поддержания целевой маржинальности
  - Если маржа упала более чем на 20% и включено "Автоматически выходить из акций":
    - Выходим из акции
- Если товар в акции и НЕ включено "Удерживать маржинальность":
  - Принимаем цену акции как есть
  - Если маржа упала более чем на 50% и включено "Автоматически выходить из акций":
    - Выходим из акции

### 3. Автоматизация
- Каждый час система:
  1. Получает товары клиента
  2. Проверяет необходимость обновления цен
  3. Рассчитывает оптимальные цены
  4. Обновляет цены или выходит из акций
  5. Логирует все изменения

## 🛠️ Установка и настройка

### 1. Запуск миграции
```bash
# Windows
run-pricing-migration.bat

# Linux/Mac
chmod +x run-pricing-migration.sh
./run-pricing-migration.sh
```

### 2. Настройка API ключей
- Получите API ключ в личном кабинете Wildberries
- Введите ключ в интерфейсе ценообразования
- Синхронизируйте товары

### 3. Настройка параметров
- Установите желаемую наценку
- Настройте логистические параметры
- Включите автоматизацию

## 📊 Мониторинг

### Логи автоматизации
- Время выполнения задач
- Количество обработанных товаров
- Статистика изменений
- Ошибки и предупреждения

### История изменений
- Все изменения цен с деталями
- Причины изменений
- Источники изменений (ручные/автоматические)

### Статистика
- Средняя маржинальность
- Количество обновлений цен
- Эффективность автоматизации

## 🔒 Безопасность

- API ключи хранятся в зашифрованном виде
- Все изменения логируются
- Ограничения на частоту запросов к API
- Валидация входных данных

## 📈 Преимущества

1. **Автоматизация** - Минимум ручной работы
2. **Контроль маржинальности** - Защита от убыточных продаж
3. **Гибкость** - Настройка под конкретные потребности
4. **Прозрачность** - Полная история изменений
5. **Эффективность** - Оптимизация цен в реальном времени

## 🚨 Ограничения

- Зависимость от API Wildberries
- Лимиты на количество запросов
- Необходимость актуальных данных о товарах
- Требует настройки для каждого клиента

## 🔧 Техническая поддержка

При возникновении проблем:
1. Проверьте логи автоматизации
2. Убедитесь в корректности API ключей
3. Проверьте настройки ценообразования
4. Обратитесь к администратору системы




