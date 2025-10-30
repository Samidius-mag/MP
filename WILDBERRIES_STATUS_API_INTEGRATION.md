# Интеграция с API статусов сборочных заданий Wildberries

## 🚀 Новые возможности

### 1. Получение точных статусов заказов
- **API endpoint:** `https://marketplace-api.wildberries.ru/api/v3/orders/status`
- **Метод:** POST
- **Функция:** `fetchWildberriesOrderStatuses()`

### 2. Два типа статусов

#### supplierStatus (Статус сборочного задания)
- `new` - Новое сборочное задание
- `confirm` - На сборке  
- `complete` - В доставке
- `cancel` - Отменено продавцом

#### wbStatus (Статус системы Wildberries)
- `waiting` - Сборочное задание в работе
- `sorted` - Сборочное задание отсортировано
- `sold` - Заказ получен покупателем
- `canceled` - Отмена сборочного задания
- `canceled_by_client` - Покупатель отменил заказ при получении
- `declined_by_client` - Покупатель отменил заказ (в первый час)
- `defect` - Отмена заказа по причине брака
- `ready_for_pickup` - Сборочное задание прибыло на ПВЗ

## 🔧 Техническая реализация

### 1. Новая функция `fetchWildberriesOrderStatuses()`

```javascript
async function fetchWildberriesOrderStatuses(apiKey, orderIds) {
  try {
    const response = await axios.post('https://marketplace-api.wildberries.ru/api/v3/orders/status', {
      orders: orderIds
    }, {
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      }
    });

    return response.data.orders || [];
  } catch (err) {
    console.error('Wildberries statuses API error:', err.response?.data || err.message);
    return [];
  }
}
```

### 2. Обновленная логика определения статуса

```javascript
// Используем данные из API статусов сборочных заданий
const supplierStatus = orderStatus.supplierStatus;
const wbStatus = orderStatus.wbStatus;

// Маппинг supplierStatus на наши статусы
switch (supplierStatus) {
  case 'new': status = 'new'; break;
  case 'confirm': status = 'in_assembly'; break;
  case 'complete': status = 'shipped'; break;
  case 'cancel': status = 'cancelled'; break;
}

// Дополнительная проверка wbStatus
if (wbStatus === 'sold') {
  status = 'delivered';
} else if (wbStatus === 'canceled' || wbStatus === 'canceled_by_client') {
  status = 'cancelled';
} else if (wbStatus === 'ready_for_pickup') {
  status = 'shipped';
}
```

### 3. Расширенный интерфейс заказа

```typescript
interface Order {
  // ... существующие поля
  supplierStatus?: string; // Статус сборочного задания
  wbStatus?: string; // Статус системы Wildberries
}
```

### 4. Детальное отображение статусов

Добавлена функция `getStatusDetails()` для отображения:
- Статуса сборки (supplierStatus)
- Статуса системы WB (wbStatus)

## 📊 Преимущества

### 1. Точность статусов
- Получаем актуальные статусы напрямую от Wildberries
- Учитываем как статус продавца, так и статус системы

### 2. Детальная информация
- Показываем пользователю подробную информацию о статусе
- Переводим технические статусы на понятный язык

### 3. Автоматическое обновление
- Статусы обновляются при каждом импорте заказов
- Нет необходимости в ручном обновлении

## 🎯 Решение проблемы с заказом тату машинки

Теперь заказ от 07.10.2025 будет правильно определен:

1. **Получаем статус** через API `/api/v3/orders/status`
2. **Анализируем supplierStatus** и wbStatus
3. **Определяем правильный статус** на основе актуальных данных
4. **Отображаем детальную информацию** пользователю

## 🔄 Процесс работы

1. **Импорт заказов** → получение списка заказов
2. **Запрос статусов** → получение статусов для всех заказов
3. **Определение статуса** → маппинг на наши статусы
4. **Отображение** → показ пользователю с деталями

## 📁 Измененные файлы

- `server/routes/client.js` - добавлена функция получения статусов
- `client/app/client/orders/page.tsx` - обновлен интерфейс заказов
- `WILDBERRIES_STATUS_API_INTEGRATION.md` - документация

## 🚀 Результат

Теперь система:
- ✅ Получает точные статусы заказов от Wildberries
- ✅ Правильно определяет статус заказа тату машинки
- ✅ Показывает детальную информацию о статусах
- ✅ Автоматически обновляет статусы при импорте












