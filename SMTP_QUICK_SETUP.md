# 🚀 Быстрая настройка SMTP

## Проблема
```
Error: Missing credentials for "PLAIN"
```

## Решение

### 1. Создайте файл .env
```bash
cd server
cp env-config.txt .env
```

### 2. Настройте SMTP в .env файле

#### Вариант A: Gmail (рекомендуется)
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-app-password
SMTP_FROM=noreply@yourcompany.com
```

**Как получить пароль приложения Gmail:**
1. Включите 2FA в Google аккаунте
2. Перейдите в настройки Google аккаунта
3. Безопасность → Пароли приложений
4. Создайте новый пароль для "Почта"
5. Скопируйте 16-символьный пароль

#### Вариант B: Yandex
```env
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=587
SMTP_USER=your-email@yandex.ru
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourcompany.com
```

#### Вариант C: Тестовый режим (без реальной отправки)
```env
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=test
SMTP_PASS=test
SMTP_FROM=test@localhost
```

### 3. Протестируйте настройку
```bash
cd server
npm run test-smtp
```

### 4. Перезапустите сервер
```bash
pm2 restart dropshipping-server
```

## Пример готового .env файла

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dropshipping_db
DB_USER=dropshipping
DB_PASSWORD=KeyOfWorld2025

# JWT
JWT_SECRET=KeyOfWorld2025
JWT_EXPIRES_IN=7d

# Server
PORT=3001
NODE_ENV=development

# CORS
CLIENT_URL=http://localhost:3000

# Email (ЗАМЕНИТЕ НА СВОИ ДАННЫЕ!)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-app-password
SMTP_FROM=noreply@yourcompany.com

# ФНС API (опционально)
FNS_API_KEY=your-fns-api-key
```

## Проверка работы

После настройки .env файла:

1. **Тест SMTP:**
   ```bash
   cd server
   npm run test-smtp
   ```

2. **Проверка логов:**
   ```bash
   pm2 logs dropshipping-server
   ```

3. **Тест регистрации:**
   - Откройте форму регистрации
   - Заполните данные
   - Проверьте, что пришел email с кодом

## Устранение проблем

### "Invalid login"
- Проверьте правильность email и пароля
- Убедитесь, что включена 2FA
- Используйте пароль приложения, а не основной пароль

### "Connection timeout"
- Проверьте настройки порта
- Проверьте firewall
- Попробуйте другой порт (465 для SSL)

### "Authentication failed"
- Проверьте настройки аутентификации
- Убедитесь, что SMTP включен у провайдера
