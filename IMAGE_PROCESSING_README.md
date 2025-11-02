# Обработка изображений товаров

## Описание

Реализована возможность автоматической замены фона на изображениях товаров, загружаемых с Sima Land.

## Возможности

### Методы обработки

1. **`auto`** (по умолчанию) - Автоматическое определение и замена светлого фона на белый
2. **`white`** - Простая замена фона на белый цвет через композицию
3. **`remove`** - Удаление фона по указанному цвету с возможностью замены на белый или прозрачный

### Параметры

- **`processImages`** - Включить обработку изображений (boolean, по умолчанию `false`)
- **`imageProcessingMethod`** - Метод обработки: `'white'`, `'remove'`, `'auto'` (по умолчанию `'auto'`)
- **`replaceWithWhite`** - Заменить на белый вместо прозрачного (boolean, по умолчанию `true`)
- **`bgColor`** - Цвет фона для замены (hex, например `'#FFFFFF'`, по умолчанию белый)

## Использование

### При загрузке товаров для клиента

```javascript
POST /api/client/sima-land/products/load
{
  "categories": [123, 456],
  "processImages": true,
  "imageProcessingMethod": "auto",
  "replaceWithWhite": true,
  "bgColor": "#FFFFFF"
}
```

### Программное использование

```javascript
const imageProcessingService = require('./services/imageProcessingService');

// Обработка изображения
const result = await imageProcessingService.processImage(imageUrl, {
  method: 'auto',
  replaceWithWhite: true,
  bgColor: '#FFFFFF'
});

// result содержит:
// {
//   filePath: '/path/to/file.png',
//   publicUrl: '/uploads/products/filename.png',
//   filename: 'filename.png'
// }
```

## Архитектура

### Сервисы

- **`imageProcessingService.js`** - Основной сервис для обработки изображений
  - Скачивание изображений по URL
  - Замена фона различными методами
  - Сохранение обработанных изображений

### Хранение

- Обработанные изображения сохраняются в `server/uploads/products/`
- Статическая отдача через Express: `/uploads/products/`
- Все изображения сохраняются в формате PNG для поддержки прозрачности

### Интеграция

- Автоматическая обработка при загрузке товаров с Sima Land (если включена опция)
- Интегрировано в методы `loadProductsForClient()` и `loadCatalog()`

## Установка зависимостей

```bash
cd server
npm install sharp@^0.33.0
```

## Настройка

### Переменные окружения

Можно добавить настройки в `.env`:

```env
# Обработка изображений
IMAGE_PROCESSING_ENABLED=false
IMAGE_PROCESSING_METHOD=auto
IMAGE_BG_COLOR=#FFFFFF
```

### Статическая отдача

В `server/index.js` настроена статическая отдача обработанных изображений:

```javascript
app.use('/uploads/products', express.static(path.join(__dirname, 'uploads', 'products')));
```

## Примеры использования

### Пример 1: Автоматическая замена светлого фона на белый

```javascript
await simaLandService.loadProductsForClient(clientId, token, jobId, {
  processImages: true,
  imageProcessingMethod: 'auto',
  replaceWithWhite: true
});
```

### Пример 2: Удаление конкретного цвета фона

```javascript
await simaLandService.loadProductsForClient(clientId, token, jobId, {
  processImages: true,
  imageProcessingMethod: 'remove',
  bgColor: '#F5F5F5', // Удаляем светло-серый фон
  replaceWithWhite: true
});
```

### Пример 3: Прозрачный фон (для дальнейшей обработки)

```javascript
await simaLandService.loadProductsForClient(clientId, token, jobId, {
  processImages: true,
  imageProcessingMethod: 'remove',
  bgColor: '#FFFFFF',
  replaceWithWhite: false // Прозрачный фон
});
```

## Обработка ошибок

Если обработка изображения не удалась:
- Используется оригинальное изображение
- В логах выводится предупреждение
- Процесс загрузки товаров не прерывается

## Производительность

- Обработка одного изображения занимает ~1-3 секунды
- При загрузке большого количества товаров обработка выполняется последовательно
- Для ускорения можно реализовать очередь обработки изображений (например, через Bull)

## Будущие улучшения

1. **AI-удаление фона** - Интеграция с сервисами типа remove.bg API или локальными моделями (rembg)
2. **Пакетная обработка** - Обработка нескольких изображений параллельно
3. **Кеширование** - Кеширование обработанных изображений, чтобы не обрабатывать повторно
4. **CDN** - Загрузка обработанных изображений в облачное хранилище (S3, Yandex Object Storage)
5. **Настройки по категориям** - Разные настройки обработки для разных категорий товаров

## API Endpoints

### POST /api/client/sima-land/products/load

Загрузить товары с Sima Land с опциональной обработкой изображений.

**Body:**
```json
{
  "categories": [123, 456],
  "processImages": true,
  "imageProcessingMethod": "auto",
  "replaceWithWhite": true,
  "bgColor": "#FFFFFF"
}
```

## Примечания

- Библиотека Sharp требует нативных зависимостей (libvips)
- На сервере должен быть установлен libvips или Sharp установится с предскомпилированными бинарниками
- Обработанные изображения занимают дополнительное место на диске
- Рекомендуется регулярно очищать старые обработанные изображения

