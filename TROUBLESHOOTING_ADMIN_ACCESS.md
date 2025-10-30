# 🔧 Диагностика проблем с доступом к админскому интерфейсу

## 🚨 Проблема
Не удается войти в админский интерфейс после добавления модуля ценообразования.

## 🔍 Диагностика

### 1. Проверка состояния сервера
```bash
# Проверьте, что сервер запущен
pm2 status

# Проверьте логи сервера
pm2 logs dropship

# Или если запущено через node
ps aux | grep node
```

### 2. Проверка health check
```bash
curl http://your-server-ip:3001/api/health
```

### 3. Проверка админского endpoint
```bash
# Должен вернуть 401 (Unauthorized) - это нормально
curl http://your-server-ip:3001/api/admin/users
```

### 4. Проверка логов на ошибки
Ищите в логах:
- `Error: Route.get() requires a callback function`
- `Cannot find module`
- `Database connection error`
- `SyntaxError`

## 🛠️ Решения

### Решение 1: Временное отключение модуля ценообразования
Модуль ценообразования временно отключен в `server/index.js`:
```javascript
// Временно отключено
// app.use('/api/pricing', authenticateToken, pricingRoutes);
```

### Решение 2: Выполнение миграции базы данных
```bash
# На сервере выполните:
cd /path/to/your/app
node server/scripts/run-migrations.js server/migrations/20250121_create_pricing_module.sql
```

### Решение 3: Перезапуск сервера
```bash
# Если используете PM2
pm2 restart dropship

# Или если запущено через node
# Остановите процесс и запустите заново
```

### Решение 4: Проверка переменных окружения
Убедитесь, что все необходимые переменные установлены:
```bash
# Проверьте .env файл
cat .env

# Или проверьте переменные в PM2
pm2 env 0
```

## 🔄 Пошаговая диагностика

### Шаг 1: Проверка базовой функциональности
```bash
# Запустите скрипт диагностики
node check-server-status.js
```

### Шаг 2: Проверка админского входа
1. Откройте браузер
2. Перейдите на `http://your-server-ip:3000/admin`
3. Попробуйте войти с админскими данными
4. Проверьте консоль браузера на ошибки (F12)

### Шаг 3: Проверка API напрямую
```bash
# Получите токен админа
curl -X POST http://your-server-ip:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your-password"}'

# Используйте токен для доступа к админскому API
curl -X GET http://your-server-ip:3001/api/admin/users \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 🚨 Частые проблемы

### 1. Ошибка "Route.get() requires a callback function"
**Причина:** Неправильный импорт middleware
**Решение:** Проверьте импорты в `server/routes/pricing.js`

### 2. Ошибка "Cannot find module"
**Причина:** Отсутствующие зависимости
**Решение:** 
```bash
npm install
```

### 3. Ошибка базы данных
**Причина:** Не выполнена миграция
**Решение:** Выполните миграцию базы данных

### 4. Ошибка аутентификации
**Причина:** Проблемы с JWT токенами
**Решение:** Проверьте JWT_SECRET в переменных окружения

## 📞 Дополнительная помощь

Если проблема не решается:

1. **Соберите логи:**
   ```bash
   pm2 logs dropship --lines 100 > server-logs.txt
   ```

2. **Проверьте статус базы данных:**
   ```bash
   # PostgreSQL
   sudo systemctl status postgresql
   
   # Или проверьте подключение
   psql -h localhost -U your_user -d your_database
   ```

3. **Проверьте порты:**
   ```bash
   netstat -tlnp | grep :3001
   netstat -tlnp | grep :3000
   ```

4. **Проверьте права доступа к файлам:**
   ```bash
   ls -la server/
   ls -la client/
   ```

## ✅ Включение модуля ценообразования

После решения проблем с админским интерфейсом:

1. Выполните миграцию базы данных
2. Раскомментируйте строки в `server/index.js`:
   ```javascript
   app.use('/api/pricing', authenticateToken, pricingRoutes);
   ```
3. Раскомментируйте запуск сервиса автоматизации
4. Перезапустите сервер




