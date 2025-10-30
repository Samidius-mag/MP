# Обновление логики определения статуса заказов

## 📊 Анализ данных Wildberries API

На основе реальных данных заказа из Wildberries API:

```json
{
  "date": "2025-10-14T10:08:27",
  "lastChangeDate": "2025-10-14T22:20:16", 
  "isCancel": false,
  "isSupply": false,
  "isRealization": true,
  "warehouseType": "Склад продавца",
  "finishedPrice": 2635,
  "totalPrice": 4200,
  "spp": 37
}
```

## 🎯 Новая логика определения статуса

### Критерии определения статуса:

1. **`isCancel: true`** → `cancelled` (Отменен)
2. **`isRealization: true` + `warehouseType: "Склад продавца"`** → `in_assembly` (На сборке)
3. **`isRealization: true` + `warehouseType: "Склад WB"`** → `shipped` (Отправлен)
4. **`isRealization: true` + `warehouseType: "Склад WB (доставка)"`** → `delivered` (Доставлен)
5. **По умолчанию** → `new` (Новый)

### Пример анализа заказа:

Заказ с данными выше имеет статус **`in_assembly`** потому что:
- ✅ `isCancel: false` - не отменен
- ✅ `isRealization: true` - в процессе реализации
- ✅ `warehouseType: "Склад продавца"` - находится на складе продавца
- ✅ Есть `sticker` - заказ обрабатывается

## 🔧 Внесенные изменения

### 1. Обновлена функция `fetchWildberriesOrders` в `server/routes/client.js`

```javascript
// Определяем статус заказа на основе данных Wildberries API
let status = 'new';
if (order.isCancel) {
  status = 'cancelled';
} else if (order.isRealization && order.warehouseType === 'Склад продавца') {
  status = 'in_assembly'; // Заказ на сборке
} else if (order.isRealization && order.warehouseType === 'Склад WB') {
  status = 'shipped'; // Заказ отправлен
} else if (order.isRealization && order.warehouseType === 'Склад WB (доставка)') {
  status = 'delivered'; // Заказ доставлен
} else if (order.status) {
  // Маппинг статусов Wildberries на наши
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

### 2. Обновлена функция `fetchWildberriesOrders` в `server/routes/marketplace.js`

Добавлена аналогичная логика для консистентности между маршрутами.

## 📈 Ожидаемые результаты

После обновления:

### Статусы заказов будут определяться правильно:

- **Новые заказы** (`new`) - только что созданные заказы
- **На сборке** (`in_assembly`) - заказы на складе продавца в процессе обработки
- **Отправлены** (`shipped`) - заказы на складе WB
- **Доставлены** (`delivered`) - заказы в процессе доставки
- **Отменены** (`cancelled`) - отмененные заказы

### На дашборде будет корректная статистика:

- 🔵 **Новые заказы** - заказы, требующие обработки
- 🟡 **На сборке** - заказы в процессе сборки на складе продавца
- 🟢 **В доставке** - отправленные и доставленные заказы

## 🚀 Инструкция по применению

1. **Перезапустите сервер** для применения изменений
2. **Очистите существующие данные** (опционально): `./clean-orders.bat`
3. **Импортируйте заказы заново** с правильными статусами
4. **Проверьте дашборд** - статистика должна отображаться корректно

## 🔍 Проверка работы

### Логи сервера должны показывать:
```
Found 37 orders
Wildberries API response: [заказы с правильными статусами]
```

### В интерфейсе должно отображаться:
- Правильные статусы заказов
- Корректная статистика на дашборде
- Правильное распределение по категориям

## 📁 Измененные файлы

- `server/routes/client.js` - обновлена логика определения статуса
- `server/routes/marketplace.js` - добавлена аналогичная логика
- `ORDERS_STATUS_LOGIC_UPDATE.md` - документация изменений

## 🎯 Результат

Теперь система будет правильно определять статусы заказов на основе реальных данных Wildberries API, что обеспечит корректное отображение статистики и фильтрацию заказов.












