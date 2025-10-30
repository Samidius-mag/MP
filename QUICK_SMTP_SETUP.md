# 🚀 Быстрая настройка SMTP

## ⚡ За 2 минуты

### 1. Автоматическая настройка
```bash
cd server
npm run setup-env
```

### 2. Тестирование
```bash
npm run test-smtp
```

### 3. Запуск сервера
```bash
npm start
```

## 📧 Ручная настройка

### 1. Создайте .env файл
```bash
cd server
cp env.example .env
```

### 2. Настройте Gmail (самый простой способ)

1. **Включите 2FA в Google аккаунте**
2. **Создайте пароль приложения:**
   - Google аккаунт → Безопасность
   - Пароли приложений → Создать
   - Выберите "Почта" → Создать
   - Скопируйте 16-символьный пароль

3. **Обновите .env:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-app-password
SMTP_FROM=noreply@yourcompany.com
```

### 3. Протестируйте
```bash
npm run test-smtp
```

## ✅ Готово!

После настройки SMTP:
- ✅ Email коды будут отправляться автоматически
- ✅ Пользователи смогут подтверждать регистрацию
- ✅ Система будет работать полностью

## 🔧 Альтернативные провайдеры

### Yandex
```env
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=587
SMTP_USER=your-email@yandex.ru
SMTP_PASS=your-app-password
```

### SendGrid
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

## 🆘 Проблемы?

### "Invalid login"
- Проверьте правильность email и пароля
- Убедитесь, что включена 2FA
- Используйте пароль приложения

### "Connection timeout"
- Проверьте настройки порта
- Проверьте firewall
- Попробуйте другой порт (465 для SSL)

### "Authentication failed"
- Проверьте настройки аутентификации
- Убедитесь, что SMTP включен у провайдера

## 📞 Поддержка

Если возникли проблемы:
1. Проверьте логи сервера
2. Запустите `npm run test-smtp`
3. Проверьте настройки .env
4. Обратитесь к документации провайдера
