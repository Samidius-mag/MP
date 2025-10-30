# 💳 Интеграция СБП платежей через ВТБ API

## 🎯 Обзор

Реализована полная интеграция с [ВТБ СБП API](https://sandbox.vtb.ru/integration/api/rest.html#sbp-payments) для обработки платежей через Систему быстрых платежей (СБП).

## 🔧 Возможности

### ✅ Реализованные функции:
- **Создание заказов** для СБП платежей
- **Генерация QR-кодов** для оплаты
- **Проверка статуса** платежей в реальном времени
- **Webhook уведомления** от ВТБ
- **Проверка подписи** уведомлений (HMAC-SHA256 и RSA-SHA512)
- **Автоматическое обновление** баланса депозита
- **Модальное окно** с QR-кодом для клиентов

## 🗄️ Архитектура

### Сервисы:
- `VtbSbpService` - основной сервис для работы с ВТБ API
- `Payment routes` - маршруты для обработки платежей
- `Webhook handler` - обработчик уведомлений от ВТБ

### API эндпоинты:
- `POST /api/payment/deposit` - создание депозита с СБП
- `POST /api/payment/sbp-webhook` - webhook от ВТБ
- `GET /api/payment/sbp-status/:orderId` - проверка статуса

## ⚙️ Настройка

### 1. Получение доступа к ВТБ API

1. Зарегистрируйтесь в [ВТБ Бизнес Онлайн](https://www.vtb.ru/business/)
2. Подайте заявку на подключение к СБП API
3. Получите учетные данные:
   - Merchant ID
   - API Username/Password или Token
   - Секретные ключи для подписи

### 2. Настройка переменных окружения

Скопируйте `server/env-sbp-example.txt` в `.env`:

```bash
# ВТБ СБП API настройки
VTB_SBP_BASE_URL=https://sandbox.vtb.ru/integration/api/rest
VTB_MERCHANT_ID=your_merchant_id
VTB_USER_NAME=your_api_username
VTB_PASSWORD=your_api_password

# Для симметричной криптографии (рекомендуется)
VTB_SECRET_KEY=your_secret_key

# URL для уведомлений
SERVER_BASE_URL=http://localhost:5000
CLIENT_BASE_URL=http://localhost:3000
```

### 3. Настройка webhook URL

В личном кабинете ВТБ укажите URL для уведомлений:
```
https://yourdomain.com/api/payment/sbp-webhook
```

## 🔐 Безопасность

### Проверка подписи уведомлений

Система поддерживает два метода проверки подписи:

#### 1. Симметричная криптография (HMAC-SHA256)
```javascript
const dataString = 'amount;123456;mdOrder;order-id;operation;deposited;orderNumber;10747;status;1;';
const signature = crypto.createHmac('sha256', secretKey).update(dataString).digest('hex');
```

#### 2. Асимметричная криптография (RSA-SHA512)
```javascript
const dataString = 'amount;123456;mdOrder;order-id;operation;deposited;orderNumber;10747;status;1;';
const signature = crypto.createSign('sha512').update(dataString).sign(privateKey, 'hex');
```

## 📱 Пользовательский интерфейс

### Модальное окно СБП
- **QR-код** для сканирования в банковском приложении
- **Сумма платежа** и ID заказа
- **Статус платежа** в реальном времени
- **Кнопка "Открыть в браузере"** для десктопных устройств
- **Автоматическая проверка** статуса каждые 5 секунд

### Статусы платежей:
- `pending` - Ожидание оплаты
- `1` - Оплачено
- `2` - Отклонено
- `3` - Отменено

## 🔄 Процесс оплаты

### 1. Создание платежа
```javascript
const paymentData = {
  orderNumber: 'pay_1640995200000_abc123',
  amount: 1000000, // 10,000 ₽ в копейках
  description: 'Пополнение депозита на 10000 ₽',
  returnUrl: 'https://client.com/deposit?success=true',
  failUrl: 'https://client.com/deposit?error=true',
  notificationUrl: 'https://server.com/api/payment/sbp-webhook'
};
```

### 2. Получение QR-кода
```javascript
const result = await vtbSbpService.createSbpPayment(paymentData);
// result.qrCode - base64 изображение QR-кода
// result.qrCodeUrl - URL для отображения QR-кода
// result.paymentUrl - ссылка для оплаты в браузере
```

### 3. Проверка статуса
```javascript
const status = await vtbSbpService.checkPaymentStatus(orderId);
// status.status - статус платежа
// status.amount - сумма
// status.operation - тип операции
```

## 📊 Мониторинг и логирование

### Логи операций
Все операции логируются в консоль:
```javascript
console.log('SBP Webhook received:', webhookData);
console.log('SBP payment completed for deposit', depositId);
console.log('SBP payment failed for deposit', depositId);
```

### Уведомления клиентам
- Успешная оплата: "Депозит пополнен на X ₽ через СБП"
- Ошибка оплаты: "Платеж отклонен или отменен"

## 🧪 Тестирование

### Sandbox окружение
Используйте тестовое окружение ВТБ:
```
VTB_SBP_BASE_URL=https://sandbox.vtb.ru/integration/api/rest
```

### Тестовые данные
- Тестовые карты для проверки
- Тестовые суммы (до 1000 ₽)
- Тестовые webhook уведомления

## 🚀 Развертывание

### 1. Установка зависимостей
```bash
cd server
npm install
```

### 2. Настройка переменных окружения
```bash
cp env-sbp-example.txt .env
# Отредактируйте .env с реальными данными
```

### 3. Запуск сервера
```bash
npm start
```

### 4. Проверка работы
```bash
curl -X POST http://localhost:5000/api/payment/deposit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"amount": 1000, "payment_method": "sbp"}'
```

## 🔧 API Reference

### VtbSbpService

#### createSbpPayment(paymentData)
Создает СБП платеж и возвращает QR-код.

**Параметры:**
- `orderNumber` - номер заказа
- `amount` - сумма в копейках
- `description` - описание платежа
- `returnUrl` - URL возврата
- `failUrl` - URL при ошибке
- `notificationUrl` - URL для уведомлений

**Возвращает:**
```javascript
{
  success: true,
  orderId: "order-id",
  qrCode: "base64-qr-code",
  qrCodeUrl: "https://qr-url",
  paymentUrl: "https://payment-url",
  amount: 1000000
}
```

#### checkPaymentStatus(orderId)
Проверяет статус платежа.

**Возвращает:**
```javascript
{
  success: true,
  orderId: "order-id",
  status: "1",
  amount: 1000000,
  operation: "deposited"
}
```

#### verifyNotificationSignature(data, signature)
Проверяет подпись уведомления.

**Возвращает:** `boolean`

## 🐛 Устранение неполадок

### Частые проблемы:

#### 1. Ошибка "Invalid signature"
- Проверьте правильность `VTB_SECRET_KEY`
- Убедитесь, что используется правильный алгоритм (HMAC-SHA256)

#### 2. Ошибка "Order not found"
- Проверьте правильность `orderId` в webhook
- Убедитесь, что заказ существует в базе данных

#### 3. QR-код не отображается
- Проверьте правильность `VTB_SBP_BASE_URL`
- Убедитесь, что API возвращает корректные данные

#### 4. Webhook не приходят
- Проверьте правильность `notificationUrl`
- Убедитесь, что сервер доступен извне
- Проверьте настройки в личном кабинете ВТБ

### Логи для отладки:
```javascript
// Включите подробное логирование
console.log('SBP Webhook received:', JSON.stringify(webhookData, null, 2));
console.log('Signature verification:', vtbSbpService.verifyNotificationSignature(webhookData, signature));
```

## 📞 Поддержка

При возникновении проблем:
1. Проверьте логи сервера
2. Убедитесь в правильности настроек
3. Обратитесь в поддержку ВТБ
4. Создайте тикет в системе поддержки

## 🔗 Полезные ссылки

- [ВТБ СБП API Документация](https://sandbox.vtb.ru/integration/api/rest.html#sbp-payments)
- [ВТБ Бизнес Онлайн](https://www.vtb.ru/business/)
- [Техническая поддержка ВТБ](https://www.vtb.ru/business/support/)


