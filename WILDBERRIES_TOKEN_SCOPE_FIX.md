# Исправление ошибки "token scope not allowed" в Wildberries API

## 🚨 Проблема

При импорте заказов с Wildberries возникает ошибка:
```
❌ WB FBS /orders/new error: {
  title: 'unauthorized',
  detail: 'token scope not allowed',
  code: '461a0b83d6bd a53a3d31f8b003bce 8d7a4aaab17a',
  requestId: '243ee504c388f7a20d9d79a0bb5347f9',
  origin: 's2s-api-auth-marketplace',
  status: 401,
  statusText: 'Unauthorized',
  timestamp: '2025-10-22T06:35:00Z'
}
```

## 🔍 Причина

Ошибка возникает потому, что API токен Wildberries не имеет правильных разрешений (scope) для доступа к Marketplace API. Согласно [документации Wildberries API](https://dev.wildberries.ru/openapi/api-information), токены имеют разные категории:

- **Statistics API** - требует токен категории "Statistics"
- **Marketplace API** - требует токен категории "Marketplace" 
- **Common API** - требует токен категории "General"

## ✅ Решение

### Шаг 1: Создание нового токена

1. Зайдите в [личный кабинет продавца Wildberries](https://seller.wildberries.ru/)
2. Перейдите в **Профиль** → **Интеграции** → **API**
3. Создайте **НОВЫЙ токен** с категорией **"Marketplace"**
4. Скопируйте новый токен

### Шаг 2: Обновление токена в системе

1. Зайдите в настройки системы
2. Перейдите в **Settings** → **API Keys**
3. В разделе **Wildberries** вставьте новый токен
4. Сохраните настройки

### Шаг 3: Проверка работы

После обновления токена:
- Импорт заказов должен работать без ошибок
- В логах сервера должны появиться сообщения об успешном получении заказов

## 🔧 Технические детали

### API endpoints, которые требуют Marketplace токен:
- `https://marketplace-api.wildberries.ru/api/v3/orders/new` - новые заказы
- `https://marketplace-api.wildberries.ru/api/v3/orders/status` - статусы заказов
- `https://marketplace-api.wildberries.ru/api/v3/orders/client` - данные клиентов

### API endpoints, которые работают с любым токеном:
- `https://common-api.wildberries.ru/api/v1/seller-info` - информация о продавце
- `https://common-api.wildberries.ru/api/communications/v2/news` - новости
- `https://statistics-api.wildberries.ru/api/v1/supplier/orders` - статистика заказов

## 🛠️ Улучшения в коде

Внесены следующие улучшения:

1. **Улучшенная диагностика ошибок** - система теперь выводит подробные инструкции при ошибке "token scope not allowed"

2. **Проверка токенов при сохранении** - система проверяет валидность токена при его обновлении

3. **Детальные сообщения об ошибках** - пользователь получает понятные инструкции по исправлению проблемы

## 📋 Проверочный список

- [ ] Создан новый токен с категорией "Marketplace" в личном кабинете WB
- [ ] Токен обновлен в настройках системы
- [ ] Импорт заказов работает без ошибок
- [ ] В логах сервера нет ошибок "token scope not allowed"

## 🆘 Если проблема не решается

1. Убедитесь, что токен создан с правильной категорией "Marketplace"
2. Проверьте, что токен не истек
3. Убедитесь, что аккаунт продавца активен
4. Обратитесь в техническую поддержку Wildberries

## 📞 Поддержка

При возникновении проблем с API Wildberries обращайтесь в техническую поддержку через диалоги в личном кабинете продавца, используя категорию **API**.


