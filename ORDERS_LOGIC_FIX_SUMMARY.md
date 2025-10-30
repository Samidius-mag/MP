# Исправление логики обработки заказов

## 🐛 Обнаруженные проблемы

1. **Неправильная обработка дат** - Wildberries API возвращает Unix timestamp, но код обрабатывал как ISO строки
2. **Все заказы помечались как "new"** - отсутствовала логика определения статуса
3. **Дублирование заказов** - заказы импортировались повторно
4. **Неправильное отображение дат** - добавление 'Z' к уже корректным датам

## ✅ Внесенные исправления

### 1. Исправлена функция `fetchWildberriesOrders` в `server/routes/client.js`

**Проблемы:**
- Неправильная обработка дат из Wildberries API
- Отсутствие логики определения статуса заказов
- Все заказы помечались как "new"

**Исправления:**
```javascript
// Правильная обработка дат (Unix timestamp)
let orderDate;
if (order.date) {
  if (typeof order.date === 'number') {
    orderDate = new Date(order.date);
  } else {
    orderDate = new Date(order.date);
  }
} else {
  orderDate = new Date();
}

// Логика определения статуса
let status = 'new';
if (order.isCancel) {
  status = 'cancelled';
} else if (order.status) {
  const statusMap = {
    'new': 'new',
    'confirm': 'in_assembly',
    'cancel': 'cancelled',
    'delivered': 'delivered',
    'shipped': 'shipped'
  };
  status = statusMap[order.status] || 'new';
}
```

### 2. Исправлено отображение дат в клиентской части

**Файлы:** `client/app/client/orders/page.tsx`, `client/app/client/dashboard/page.tsx`

**Было:**
```javascript
{new Date(order.created_at + 'Z').toLocaleDateString('ru-RU')}
```

**Стало:**
```javascript
{new Date(order.created_at).toLocaleDateString('ru-RU')}
```

### 3. Добавлена поддержка периодов импорта

- **Сегодня** - заказы за текущий день
- **7 дней** - заказы за последние 7 дней
- **Месяц** - заказы за последние 30 дней

### 4. Улучшено определение типов заказов

```javascript
// Определяем тип заказа на основе данных
let orderType = 'FBS'; // По умолчанию

if (order.isFBS !== undefined) {
  orderType = order.isFBS ? 'FBS' : 'DBW';
} else if (order.deliveryType) {
  switch (order.deliveryType) {
    case 'fbs': orderType = 'FBS'; break;
    case 'dbw': orderType = 'DBW'; break;
    case 'dbs': orderType = 'DBS'; break;
  }
}
```

## 🧹 Скрипт очистки данных

### `clean-orders.js`
Автоматически:
1. Удаляет дубликаты заказов
2. Обновляет статусы старых заказов:
   - Старше 7 дней → 'delivered'
   - Старше 3 дней → 'shipped'
3. Исправляет типы заказов
4. Показывает статистику

### `clean-orders.bat`
Удобный запуск скрипта очистки с подтверждением

## 🚀 Инструкция по исправлению

### 1. Выполните миграцию (если еще не сделано)
```bash
./add-order-type-migration.bat
```

### 2. Очистите существующие данные
```bash
./clean-orders.bat
```

### 3. Перезапустите сервер
```bash
# Docker
docker-compose restart

# Локально
cd server && npm start
```

### 4. Проверьте импорт заказов
1. Откройте страницу заказов
2. Выберите период импорта
3. Нажмите "Импорт заказов"
4. Проверьте, что заказы отображаются с правильными датами и статусами

## 📊 Ожидаемые результаты

После исправлений:
- ✅ Даты заказов отображаются корректно
- ✅ Статусы заказов определяются правильно
- ✅ Типы заказов (FBS, DBW, DBS) отображаются
- ✅ Нет дубликатов заказов
- ✅ Старые заказы имеют соответствующие статусы

## 🔍 Отладка

### Проверка логов сервера
```bash
# Docker
docker logs dropshipping-server

# Локально
# Смотрите консоль сервера
```

### Проверка данных в базе
```sql
SELECT 
  status,
  order_type,
  COUNT(*) as count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM orders 
GROUP BY status, order_type
ORDER BY status, order_type;
```

## 📁 Измененные файлы

- `server/routes/client.js` - исправлена логика обработки заказов
- `client/app/client/orders/page.tsx` - исправлено отображение дат
- `client/app/client/dashboard/page.tsx` - исправлено отображение дат
- `clean-orders.js` - скрипт очистки данных
- `clean-orders.bat` - bat-файл для запуска очистки












