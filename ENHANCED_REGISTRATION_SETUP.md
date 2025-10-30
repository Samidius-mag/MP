# Настройка улучшенной системы регистрации и авторизации

## Обзор изменений

Реализована комплексная система регистрации и авторизации с множественными проверками безопасности:

### Регистрация
1. ✅ **Обязательная верификация email** - отправка кода подтверждения
2. ✅ **Обязательная верификация телефона** - отправка SMS с кодом
3. ✅ **Убрано поле роли** - все пользователи по умолчанию клиенты
4. ✅ **Добавлены поля компании** - форма (ИП/ООО), ИНН, ОГРН с проверкой через API ФНС
5. ✅ **Строгая валидация пароля** - минимум 8 символов, заглавная буква, спецсимвол
6. ✅ **Согласие с офертой** - обязательная галочка
7. ✅ **Подсказки для полей** - знаки вопроса с описанием

### Авторизация
1. ✅ **"Запомнить меня"** - расширенная сессия до 30 дней
2. ✅ **Автоматический выход через 14 дней** - принудительное обновление сессии
3. ✅ **Вход через телефон** - альтернатива email
4. ✅ **2FA поддержка** - Google Authenticator/Citrix

## Установка и настройка

### 1. Запуск миграции базы данных

```bash
# Windows
run-enhanced-registration-migration.bat

# Linux/Mac
chmod +x run-enhanced-registration-migration.sh
./run-enhanced-registration-migration.sh

# Или вручную
cd server
node -e "
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'dropshipping',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Выполнение миграции...');
    const migrationSQL = fs.readFileSync(path.join(__dirname, 'migrations', '20250115_enhanced_registration.sql'), 'utf8');
    await client.query(migrationSQL);
    console.log('Миграция выполнена успешно!');
  } catch (error) {
    console.error('Ошибка миграции:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
"
```

### 2. Установка зависимостей

```bash
# Сервер
cd server
npm install speakeasy

# Клиент (если нужно)
cd ../client
npm install
```

### 3. Настройка переменных окружения

Скопируйте `server/env.example` в `server/.env` и настройте:

```env
# Email для верификации
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourcompany.com

# ФНС API для проверки ИНН
FNS_API_KEY=your-fns-api-key

# SMS API (опционально)
SMS_API_KEY=your-sms-api-key
SMS_API_URL=https://api.sms.ru/sms/send

# JWT настройки
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=14d
```

### 4. Получение API ключей

#### ФНС API (обязательно)
1. Зарегистрируйтесь на https://api-fns.ru/
2. Получите API ключ (бесплатный тариф: 100 запросов/месяц)
3. Добавьте в переменные окружения

**Используемые методы API-ФНС:**
- `egr` - получение данных о компании по ИНН
- `check` - проверка на признаки недобросовестности

#### SMS API (опционально)
1. Зарегистрируйтесь на https://sms.ru/
2. Получите API ключ
3. Добавьте в переменные окружения

#### Email SMTP (обязательно)
1. Настройте Gmail App Password или другой SMTP сервер
2. Добавьте данные в переменные окружения

## Структура базы данных

### Новые поля в таблице `users`:
- `email_verified` - статус верификации email
- `phone_verified` - статус верификации телефона
- `two_factor_enabled` - включена ли 2FA
- `two_factor_secret` - секрет для 2FA
- `remember_token` - токен "запомнить меня"
- `last_login` - время последнего входа
- `session_expires` - срок действия сессии

### Новые поля в таблице `clients`:
- `company_form` - форма компании (IP/OOO)
- `inn` - ИНН
- `ogrn` - ОГРН
- `fns_verified` - проверен ли через ФНС
- `terms_accepted` - принята ли оферта

### Новые таблицы:
- `verification_codes` - коды верификации
- `user_sessions` - сессии пользователей

## API Endpoints

### Регистрация
- `POST /api/auth/register` - создание пользователя
- `POST /api/auth/verify-email` - подтверждение email
- `POST /api/auth/verify-phone` - подтверждение телефона
- `POST /api/auth/resend-code` - повторная отправка кода

### Авторизация
- `POST /api/auth/login` - вход через email
- `POST /api/auth/login-phone` - вход через телефон
- `POST /api/auth/verify-2fa` - подтверждение 2FA

## Безопасность

1. **Пароли** - минимум 8 символов, заглавная буква, спецсимвол
2. **Верификация** - обязательная для email и телефона
3. **Сессии** - автоматическое истечение через 14 дней
4. **2FA** - опциональная двухфакторная аутентификация
5. **ФНС проверка** - валидация ИНН в реальном времени

## Тестирование

1. Запустите сервер: `cd server && npm start`
2. Запустите клиент: `cd client && npm run dev`
3. Перейдите на http://localhost:3000/register
4. Попробуйте зарегистрироваться с тестовыми данными

## Устранение неполадок

### Ошибка "FNS API key not configured"
- Убедитесь, что `FNS_API_KEY` установлен в `.env`

### Ошибка "SMTP configuration error"
- Проверьте настройки SMTP в `.env`
- Убедитесь, что используется App Password для Gmail

### Ошибка "SMS sending error"
- SMS API не настроен - это нормально, коды выводятся в консоль

### Ошибка миграции
- Убедитесь, что база данных запущена
- Проверьте подключение к PostgreSQL
- Убедитесь, что пользователь имеет права на создание таблиц
