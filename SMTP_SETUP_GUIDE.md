# Настройка SMTP для отправки email

## 📧 Обзор

Для отправки кодов подтверждения на email пользователей необходимо настроить SMTP сервер. В проекте уже настроен `nodemailer` для работы с различными SMTP провайдерами.

## 🔧 Настройка переменных окружения

Скопируйте `server/env.example` в `server/.env` и настройте следующие переменные:

```env
# Email настройки
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourcompany.com
```

## 📮 Рекомендуемые SMTP провайдеры

### 1. Gmail (Рекомендуется для разработки)

**Преимущества:**
- Бесплатный
- Надежный
- Простая настройка

**Настройка:**
1. Включите 2FA в Google аккаунте
2. Создайте пароль приложения:
   - Перейдите в настройки Google аккаунта
   - Безопасность → Пароли приложений
   - Создайте новый пароль для "Почта"
3. Используйте этот пароль в `SMTP_PASS`

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-app-password
SMTP_FROM=noreply@yourcompany.com
```

### 2. Yandex (Рекомендуется для продакшена)

**Преимущества:**
- Российский провайдер
- Хорошая доставляемость в России
- Бесплатный тариф

**Настройка:**
1. Включите SMTP в настройках Yandex
2. Создайте пароль приложения
3. Настройте переменные:

```env
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=587
SMTP_USER=your-email@yandex.ru
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourcompany.com
```

### 3. SendGrid (Профессиональный)

**Преимущества:**
- Высокая доставляемость
- Аналитика
- Масштабируемость

**Настройка:**
1. Зарегистрируйтесь на sendgrid.com
2. Создайте API ключ
3. Настройте переменные:

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
SMTP_FROM=noreply@yourcompany.com
```

### 4. Mailgun (Профессиональный)

**Преимущества:**
- Отличная доставляемость
- Детальная аналитика
- API и SMTP

**Настройка:**
1. Зарегистрируйтесь на mailgun.com
2. Получите SMTP данные
3. Настройте переменные:

```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@your-domain.mailgun.org
SMTP_PASS=your-mailgun-password
SMTP_FROM=noreply@yourcompany.com
```

## 🚀 Быстрая настройка для разработки

### Вариант 1: Gmail (Самый простой)

1. **Создайте .env файл:**
```bash
cd server
cp env.example .env
```

2. **Настройте Gmail:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourcompany.com
```

3. **Получите пароль приложения:**
   - Google аккаунт → Безопасность
   - Пароли приложений → Создать
   - Выберите "Почта" → Создать
   - Скопируйте 16-символьный пароль

### Вариант 2: Тестовый режим (Без реальной отправки)

Для тестирования без настройки SMTP можно использовать тестовый режим:

```env
# В .env файле
NODE_ENV=development
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=test
SMTP_PASS=test
SMTP_FROM=test@localhost
```

И запустить локальный SMTP сервер:
```bash
npm install -g maildev
maildev
```

## 🧪 Тестирование SMTP

### 1. Проверка конфигурации

Создайте тестовый скрипт `server/test-smtp.js`:

```javascript
const nodemailer = require('nodemailer');
require('dotenv').config();

async function testSMTP() {
  const transporter = nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  try {
    await transporter.verify();
    console.log('✅ SMTP сервер настроен корректно');
    
    // Отправка тестового письма
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: 'test@example.com',
      subject: 'Тест SMTP',
      text: 'Это тестовое письмо для проверки SMTP'
    });
    
    console.log('✅ Тестовое письмо отправлено:', info.messageId);
  } catch (error) {
    console.error('❌ Ошибка SMTP:', error.message);
  }
}

testSMTP();
```

### 2. Запуск теста

```bash
cd server
node test-smtp.js
```

## 📊 Мониторинг отправки

### Логи отправки

В `server/services/verification.js` уже настроено логирование:

```javascript
// Успешная отправка
console.log('Email sent successfully');

// Ошибка отправки
console.error('Email sending error:', error);
```

### Проверка статуса

Добавьте в API endpoint для проверки статуса SMTP:

```javascript
// В server/routes/auth.js
router.get('/smtp-status', async (req, res) => {
  try {
    const transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await transporter.verify();
    res.json({ status: 'ok', message: 'SMTP настроен корректно' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});
```

## 🔒 Безопасность

### 1. Защита паролей

- Никогда не коммитьте `.env` файл
- Используйте пароли приложений, а не основные пароли
- Регулярно обновляйте пароли

### 2. Ограничения

- Настройте rate limiting для отправки email
- Ограничьте количество писем на пользователя
- Используйте очереди для массовой отправки

### 3. Мониторинг

- Отслеживайте количество отправленных писем
- Настройте алерты при ошибках
- Ведите логи доставки

## 🚨 Устранение неполадок

### Частые ошибки:

1. **"Invalid login"**
   - Проверьте правильность email и пароля
   - Убедитесь, что включена 2FA
   - Используйте пароль приложения

2. **"Connection timeout"**
   - Проверьте настройки порта
   - Проверьте firewall
   - Попробуйте другой порт (465 для SSL)

3. **"Authentication failed"**
   - Проверьте настройки аутентификации
   - Убедитесь, что SMTP включен у провайдера

4. **"Message rejected"**
   - Проверьте настройки SPF/DKIM
   - Убедитесь, что домен настроен корректно

### Диагностика:

```bash
# Проверка подключения
telnet smtp.gmail.com 587

# Проверка DNS
nslookup smtp.gmail.com

# Проверка SSL
openssl s_client -connect smtp.gmail.com:587 -starttls smtp
```

## 📈 Оптимизация

### 1. Кэширование

```javascript
// Кэширование транспорта
let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  return transporter;
}
```

### 2. Очереди

Для массовой отправки используйте очереди:

```javascript
const Queue = require('bull');
const emailQueue = new Queue('email processing');

emailQueue.process(async (job) => {
  const { email, code } = job.data;
  await verificationService.sendEmailVerification(email, code);
});
```

## 🎯 Готово!

После настройки SMTP:

1. ✅ Email коды будут отправляться автоматически
2. ✅ Пользователи смогут подтверждать регистрацию
3. ✅ Система будет работать полностью

**Следующие шаги:**
1. Настройте SMTP в `.env`
2. Протестируйте отправку
3. Запустите сервер
4. Попробуйте регистрацию
