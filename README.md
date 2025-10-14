# Система автоматизации дропшиппинг-бизнеса

Веб-система с личными кабинетами для клиентов и операторов, интегрированная с маркетплейсами и складом.

## Функциональность

### Личный кабинет клиента
- Регистрация/авторизация
- Привязка API-ключей маркетплейсов (WB, Ozon, Яндекс.Маркет)
- Управление депозитом (пополнение, история операций)
- Просмотр заказов со всех маркетплейсов
- Настройки профиля и компании

### Личный кабинет оператора
- Обработка заказов на сборку
- Изменение статусов заказов
- Печать стикеров
- Поиск и фильтрация заказов

### Админ-панель
- Управление пользователями
- Мониторинг системы
- Настройки системы

## Технологии

### Серверная часть
- Node.js + Express
- PostgreSQL
- JWT аутентификация
- Интеграции с маркетплейсами
- Платежные системы (ЮKassa, Тинькофф, СБП)

### Клиентская часть
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- React Hook Form

## Установка и запуск

### Предварительные требования
- Node.js 18+
- PostgreSQL 13+
- npm или yarn

### 1. Клонирование репозитория
```bash
git clone <repository-url>
cd dropshipping-automation-system
```

### 2. Установка зависимостей
```bash
# Установка всех зависимостей
npm run install:all

# Или по отдельности
npm install
cd server && npm install
cd ../client && npm install
```

### 3. Настройка базы данных
1. Убедитесь, что PostgreSQL запущен
2. Создайте базу данных:
```sql
CREATE DATABASE dropshipping_db;
```

### 4. Настройка переменных окружения
Скопируйте файл `server/env.example` в `server/.env` и настройте переменные:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dropshipping_db
DB_USER=postgres
DB_PASSWORD=postgres

# JWT
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d

# Server
PORT=3001
NODE_ENV=development

# CORS
CLIENT_URL=http://localhost:3000

# Email (для уведомлений)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# API Keys для маркетплейсов
WILDBERRIES_API_KEY=your-wb-api-key
OZON_API_KEY=your-ozon-api-key
YANDEX_MARKET_API_KEY=your-yandex-api-key

# Платежные системы
YUKASSA_SHOP_ID=your-yukassa-shop-id
YUKASSA_SECRET_KEY=your-yukassa-secret-key
TINKOFF_TERMINAL_KEY=your-tinkoff-terminal-key
TINKOFF_SECRET_KEY=your-tinkoff-secret-key
```

### 5. Запуск приложения

#### Режим разработки (все сервисы одновременно)
```bash
npm run dev
```

#### Запуск по отдельности
```bash
# Серверная часть
npm run server:dev

# Клиентская часть (в другом терминале)
npm run client:dev
```

### 6. Доступ к приложению
- Клиентская часть: http://localhost:3000
- API сервер: http://localhost:3001
- Health check: http://localhost:3001/api/health

## Структура проекта

```
dropshipping-automation-system/
├── server/                 # Серверная часть (Node.js/Express)
│   ├── config/            # Конфигурация БД
│   ├── middleware/        # Middleware
│   ├── routes/           # API маршруты
│   ├── index.js          # Точка входа сервера
│   └── package.json
├── client/               # Клиентская часть (Next.js)
│   ├── app/             # Страницы приложения
│   ├── components/      # React компоненты
│   ├── lib/            # Утилиты и контексты
│   └── package.json
├── package.json         # Корневой package.json
└── README.md
```

## API Endpoints

### Аутентификация
- `POST /api/auth/register` - Регистрация
- `POST /api/auth/login` - Вход
- `GET /api/auth/profile` - Получение профиля
- `PUT /api/auth/profile` - Обновление профиля

### Клиент
- `GET /api/client/balance` - Получение баланса
- `GET /api/client/deposits` - История депозитов
- `GET /api/client/orders` - Список заказов
- `PUT /api/client/api-keys` - Настройка API ключей

### Оператор
- `GET /api/operator/orders` - Заказы для обработки
- `PUT /api/operator/orders/:id/status` - Обновление статуса
- `POST /api/operator/orders/:id/sticker` - Создание стикера

### Маркетплейсы
- `POST /api/marketplace/wildberries/import` - Импорт с WB
- `POST /api/marketplace/ozon/import` - Импорт с Ozon
- `POST /api/marketplace/yandex-market/import` - Импорт с Яндекс.Маркет

### Платежи
- `POST /api/payment/deposit` - Создание платежа
- `GET /api/payment/status/:id` - Статус платежа

## Роли пользователей

### client
- Доступ к личному кабинету клиента
- Управление депозитом и заказами
- Настройка интеграций с маркетплейсами

### operator
- Доступ к панели оператора
- Обработка заказов
- Печать стикеров

### admin
- Полный доступ к системе
- Управление пользователями
- Мониторинг и настройки

## Разработка

### Добавление новых маршрутов
1. Создайте файл в `server/routes/`
2. Подключите в `server/index.js`
3. Добавьте соответствующие страницы в `client/app/`

### Добавление новых компонентов
1. Создайте компонент в `client/components/`
2. Импортируйте и используйте в нужных страницах

### Работа с базой данных
- Схема БД создается автоматически при первом запуске
- Миграции можно добавлять в `server/config/database.js`

## Лицензия

MIT License






