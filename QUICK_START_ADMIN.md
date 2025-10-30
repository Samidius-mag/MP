# Быстрый старт - Интерфейс администратора

## 🚀 Быстрая установка

### Windows
```bash
setup-admin.bat
```

### Linux/Mac
```bash
chmod +x setup-admin.sh
./setup-admin.sh
```

### Ручная установка
```bash
# 1. Установка зависимостей
cd server && npm install
cd ../client && npm install

# 2. Создание администратора
cd ../server && npm run create-admin

# 3. Запуск
# Терминал 1: cd server && npm start
# Терминал 2: cd client && npm run dev
```

## 🔑 Доступ к админке

1. Откройте http://localhost:3000
2. Войдите с данными:
   - **Email:** admin@dropshipping.com
   - **Пароль:** Admin123!
3. Перейдите на `/admin`

## 📊 Возможности

### ✅ Управление пользователями
- Просмотр всех пользователей
- Поиск и фильтрация
- Блокировка/разблокировка
- Смена паролей
- Просмотр статистики

### ✅ Мониторинг логов
- Логи сервера и клиента
- Фильтрация по уровню, дате, пользователю
- Детальный просмотр
- Статистика ошибок

### ✅ Панель управления
- Общая статистика системы
- Ключевые показатели
- Активность пользователей

### ✅ Настройки системы
- Конфигурация параметров
- Редактирование настроек

## 🛠️ API Endpoints

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/admin/users` | Список пользователей |
| GET | `/api/admin/users/:id` | Детали пользователя |
| PUT | `/api/admin/users/:id/password` | Смена пароля |
| PUT | `/api/admin/users/:id/status` | Блокировка/активация |
| GET | `/api/admin/logs/server` | Логи сервера |
| GET | `/api/admin/logs/client` | Логи клиента |
| GET | `/api/admin/logs/stats` | Статистика логов |
| GET | `/api/admin/stats` | Общая статистика |
| GET | `/api/admin/settings` | Настройки |
| PUT | `/api/admin/settings` | Обновление настроек |

## 🔧 Настройка

### Переменные окружения для администратора
```bash
export ADMIN_EMAIL="your-admin@email.com"
export ADMIN_PASSWORD="YourSecurePassword123!"
export ADMIN_FIRST_NAME="Ваше Имя"
export ADMIN_LAST_NAME="Ваша Фамилия"
export ADMIN_PHONE="+7 (999) 123-45-67"
```

### Логирование
- **Серверные логи:** автоматически в БД
- **Клиентские логи:** через `clientLogger`
- **Уровни:** error, warn, info, debug

## 🚨 Устранение неполадок

### Проблема: Не могу войти в админку
- Проверьте, что пользователь имеет роль 'admin'
- Убедитесь, что токен авторизации действителен

### Проблема: Логи не отображаются
- Проверьте подключение к БД
- Убедитесь, что таблицы логов созданы

### Проблема: Ошибки при создании администратора
- Проверьте переменные окружения БД
- Убедитесь, что БД доступна

## 📝 Логирование на клиенте

```typescript
import { clientLogger } from '@/lib/clientLogger';

// Обычное логирование
clientLogger.info('User action', { component: 'Button', action: 'click' });
clientLogger.error('API error', { component: 'API', action: 'request' });

// Специальные методы
clientLogger.userAction('login', 'AuthForm');
clientLogger.apiError('/api/users', error);
clientLogger.componentError('UserProfile', error);
```

## 🔒 Безопасность

- Все админские endpoints требуют роль 'admin'
- Логирование всех действий администратора
- Валидация входных данных
- Хеширование паролей

## 📈 Мониторинг

- **Логи сервера:** HTTP запросы, ошибки, системные события
- **Логи клиента:** действия пользователей, ошибки компонентов
- **Статистика:** активность, ошибки, производительность

---

**Готово!** Интерфейс администратора полностью настроен и готов к использованию.





