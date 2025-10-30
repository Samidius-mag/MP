# 📊 Модуль депозита - Документация

## 🎯 Обзор

Модуль депозита обеспечивает полный цикл управления финансами в системе дропшиппинга:
- Пополнение депозита через банковские переводы с генерацией PDF счетов
- Автоматическое списание при поступлении заказов с Wildberries
- Управление прайс-листом и остатками товаров
- Обработка возвратов с возвратом средств
- API для интеграции с внешними системами

## 🗄️ Структура базы данных

### Новые таблицы:

#### 1. `price_list` - Прайс-лист товаров
```sql
- id (SERIAL PRIMARY KEY)
- article (VARCHAR(100) UNIQUE) - Артикул товара
- name (VARCHAR(500)) - Наименование
- purchase_price (DECIMAL(10,2)) - Закупочная цена
- selling_price (DECIMAL(10,2)) - Цена продажи
- markup_percent (DECIMAL(5,2)) - Наценка в %
- category (VARCHAR(100)) - Категория
- brand (VARCHAR(100)) - Бренд
- description (TEXT) - Описание
- is_active (BOOLEAN) - Активен ли товар
- created_at, updated_at (TIMESTAMP)
```

#### 2. `inventory` - Остатки товаров
```sql
- id (SERIAL PRIMARY KEY)
- article (VARCHAR(100) UNIQUE) - Артикул товара
- quantity (INTEGER) - Количество на складе
- reserved_quantity (INTEGER) - Зарезервированное количество
- available_quantity (INTEGER) - Доступное количество (вычисляемое поле)
- warehouse_location (VARCHAR(100)) - Местоположение на складе
- last_updated_by (INTEGER) - Кто последний обновил
- updated_at (TIMESTAMP)
```

#### 3. `inventory_history` - История изменений остатков
```sql
- id (SERIAL PRIMARY KEY)
- article (VARCHAR(100)) - Артикул товара
- old_quantity (INTEGER) - Старое количество
- new_quantity (INTEGER) - Новое количество
- change_type (VARCHAR(50)) - Тип изменения
- change_reason (TEXT) - Причина изменения
- changed_by (INTEGER) - Кто изменил
- order_id (INTEGER) - ID заказа (если связано)
- created_at (TIMESTAMP)
```

#### 4. `payment_orders` - Платежные поручения
```sql
- id (SERIAL PRIMARY KEY)
- client_id (INTEGER) - ID клиента
- deposit_id (INTEGER) - ID депозита
- amount (DECIMAL(15,2)) - Сумма
- bank_account (VARCHAR(50)) - Счет получателя
- bank_name (VARCHAR(255)) - Наименование банка
- bank_bik (VARCHAR(20)) - БИК банка
- purpose (VARCHAR(500)) - Назначение платежа
- payment_order_file_path (VARCHAR(500)) - Путь к файлу
- status (VARCHAR(50)) - Статус (pending/verified/rejected)
- verified_at (TIMESTAMP) - Дата проверки
- verified_by (INTEGER) - Кто проверил
- rejection_reason (TEXT) - Причина отклонения
- created_at (TIMESTAMP)
```

#### 5. `product_returns` - Возвраты товаров
```sql
- id (SERIAL PRIMARY KEY)
- order_id (INTEGER) - ID заказа
- article (VARCHAR(100)) - Артикул товара
- quantity (INTEGER) - Количество
- return_reason (VARCHAR(100)) - Причина возврата
- return_status (VARCHAR(50)) - Статус возврата
- refund_amount (DECIMAL(10,2)) - Сумма к возврату
- processed_at (TIMESTAMP) - Дата обработки
- processed_by (INTEGER) - Кто обработал
- notes (TEXT) - Заметки
- created_at (TIMESTAMP)
```

### Обновленные таблицы:

#### `deposits` - Депозиты (добавлены поля)
```sql
- invoice_number (VARCHAR(50)) - Номер счета
- invoice_file_path (VARCHAR(500)) - Путь к PDF счету
- payment_order_file_path (VARCHAR(500)) - Путь к платежному поручению
- bank_verification_status (VARCHAR(50)) - Статус проверки банком
- bank_verification_date (TIMESTAMP) - Дата проверки банком
- bank_verification_notes (TEXT) - Заметки банка
```

## 🔧 API Эндпоинты

### Для клиентов (`/api/payment`)

#### 1. Создание депозита
```http
POST /api/payment/deposit
Content-Type: application/json
Authorization: Bearer <token>

{
  "amount": 10000,
  "payment_method": "bank_transfer"
}
```

**Ответ:**
```json
{
  "message": "Payment created successfully",
  "paymentId": "pay_1640995200000_abc123",
  "amount": 10000,
  "paymentUrl": {
    "type": "bank_transfer",
    "details": {
      "account": "40702810100000000000",
      "bank": "ПАО \"Сбербанк\"",
      "bik": "044525225",
      "purpose": "Пополнение депозита. ID: pay_1640995200000_abc123"
    }
  },
  "depositId": 123,
  "invoiceNumber": "INV-1640995200000",
  "invoiceFile": "invoices/invoice_INV-1640995200000_1640995200000.pdf"
}
```

#### 2. Загрузка платежного поручения
```http
POST /api/payment/upload-payment-order/:depositId
Content-Type: multipart/form-data
Authorization: Bearer <token>

paymentOrder: <file>
```

#### 3. Скачивание PDF счета
```http
GET /api/payment/download-invoice/:depositId
Authorization: Bearer <token>
```

#### 4. Получение списка депозитов
```http
GET /api/payment/deposits
Authorization: Bearer <token>
```

### Для операторов (`/api/operator`)

#### 1. Управление прайс-листом
```http
# Получение прайс-листа
GET /api/operator/price-list?page=1&limit=20&category=electronics&search=phone

# Добавление товара
POST /api/operator/price-list
{
  "article": "PHONE001",
  "name": "Смартфон iPhone 15",
  "purchase_price": 50000,
  "selling_price": 60000,
  "category": "electronics",
  "brand": "Apple",
  "description": "Новый iPhone 15"
}

# Обновление товара
PUT /api/operator/price-list/PHONE001
{
  "selling_price": 65000,
  "is_active": true
}
```

#### 2. Управление остатками
```http
# Обновление остатков
PUT /api/operator/inventory/PHONE001
{
  "quantity": 50,
  "warehouse_location": "Склад А, стеллаж 1"
}

# Массовое обновление
POST /api/operator/inventory/bulk-update
{
  "updates": [
    {
      "article": "PHONE001",
      "quantity": 50,
      "warehouse_location": "Склад А"
    },
    {
      "article": "PHONE002",
      "quantity": 30,
      "warehouse_location": "Склад Б"
    }
  ]
}

# История изменений
GET /api/operator/inventory/PHONE001/history?page=1&limit=20
```

### Для администраторов (`/api/admin`)

#### 1. Проверка платежных поручений
```http
# Получение списка
GET /api/admin/payment-orders?status=pending&page=1&limit=20

# Проверка платежа
POST /api/admin/payment-orders/:orderId/verify
{
  "status": "verified",
  "notes": "Платеж подтвержден"
}

# Скачивание файла
GET /api/admin/payment-orders/:orderId/download
```

#### 2. Управление возвратами
```http
# Получение списка возвратов
GET /api/admin/returns?status=pending&page=1&limit=20

# Обработка возврата
POST /api/admin/returns/:returnId/process
{
  "action": "approve",
  "notes": "Возврат одобрен"
}
```

### Внешний API (`/api/external`)

#### 1. API для прайс-листа
```http
# Получение прайс-листа
GET /api/external/price-list?page=1&limit=100
X-API-Key: <api_key>

# Обновление через JSON
POST /api/external/price-list/update
X-API-Key: <api_key>
{
  "products": [
    {
      "article": "PHONE001",
      "name": "Смартфон iPhone 15",
      "purchase_price": 50000,
      "selling_price": 60000,
      "category": "electronics",
      "brand": "Apple"
    }
  ]
}

# Импорт из Excel/CSV
POST /api/external/price-list/import
X-API-Key: <api_key>
Content-Type: multipart/form-data

file: <excel_or_csv_file>
```

#### 2. API для остатков
```http
# Получение остатков
GET /api/external/inventory?page=1&limit=100
X-API-Key: <api_key>

# Обновление остатков
POST /api/external/inventory/update
X-API-Key: <api_key>
{
  "updates": [
    {
      "article": "PHONE001",
      "quantity": 50,
      "warehouse_location": "Склад А"
    }
  ]
}

# Импорт из Excel/CSV
POST /api/external/inventory/import
X-API-Key: <api_key>
Content-Type: multipart/form-data

file: <excel_or_csv_file>
```

## 📋 Форматы файлов для импорта

### Excel/CSV для прайс-листа
| Артикул | Наименование | Закупочная_цена | Цена_продажи | Категория | Бренд | Описание |
|---------|--------------|-----------------|--------------|-----------|-------|----------|
| PHONE001 | Смартфон iPhone 15 | 50000 | 60000 | electronics | Apple | Новый iPhone 15 |
| PHONE002 | Смартфон Samsung S24 | 45000 | 55000 | electronics | Samsung | Флагман Samsung |

### Excel/CSV для остатков
| Артикул | Количество | Склад |
|---------|------------|-------|
| PHONE001 | 50 | Склад А, стеллаж 1 |
| PHONE002 | 30 | Склад Б, стеллаж 2 |

## 🔄 Автоматические процессы

### 1. Списание при заказах
- При поступлении нового заказа с Wildberries автоматически списывается закупочная стоимость товаров
- Если товар не найден в прайс-листе, используется 70% от цены продажи
- При недостатке средств заказ остается в статусе "новый" без списания

### 2. Возврат средств
- При одобрении возврата товара администратором автоматически возвращается закупочная стоимость
- Сумма возврата рассчитывается пропорционально количеству возвращаемого товара

### 3. Логирование изменений
- Все изменения остатков логируются в таблице `inventory_history`
- Отслеживается кто, когда и почему изменил остатки

## 🚀 Установка и настройка

### 1. Запуск миграций
```bash
# Windows
run-price-list-migration.bat

# Linux/Mac
chmod +x run-price-list-migration.sh
./run-price-list-migration.sh
```

### 2. Установка зависимостей
```bash
cd server
npm install
```

### 3. Настройка API ключей
API ключи настраиваются в личном кабинете клиента и используются для доступа к внешнему API.

## 📊 Мониторинг и отчетность

### 1. Логи операций
- Все операции с депозитами логируются в таблице `deposits`
- Действия администраторов логируются в таблице `admin_logs`
- Изменения остатков логируются в таблице `inventory_history`

### 2. Уведомления
- Клиенты получают уведомления о пополнении депозита
- Уведомления о списании средств за заказы
- Уведомления о возврате средств

### 3. Статистика
- Текущий баланс депозита
- История операций
- Статистика по товарам и остаткам

## 🔒 Безопасность

### 1. API ключи
- Каждый клиент имеет уникальный API ключ
- API ключи проверяются на каждом запросе к внешнему API
- Ключи можно отозвать в любое время

### 2. Права доступа
- Клиенты могут только просматривать свои данные
- Операторы могут управлять прайс-листом и остатками
- Администраторы имеют полный доступ ко всем функциям

### 3. Валидация данных
- Все входящие данные валидируются
- Файлы проверяются на тип и размер
- SQL-инъекции предотвращены через параметризованные запросы

## 🐛 Устранение неполадок

### 1. Проблемы с PDF генерацией
- Проверьте права доступа к папке `server/invoices`
- Убедитесь, что PDFKit установлен корректно

### 2. Проблемы с загрузкой файлов
- Проверьте права доступа к папке `server/uploads`
- Убедитесь, что multer настроен корректно

### 3. Проблемы с API
- Проверьте правильность API ключа
- Убедитесь, что заголовок `X-API-Key` передается корректно

## 📞 Поддержка

При возникновении проблем обращайтесь к администратору системы или создавайте тикет в системе поддержки.


