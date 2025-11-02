# Логирование обработки изображений

## Обзор

Система логирования отслеживает все этапы обработки изображений при замене фона:
- Загрузка изображений с Sima Land
- Обработка (замена/удаление фона)
- Сохранение обработанных изображений
- Статистика и ошибки

## Где смотреть логи

### 1. В базе данных

Логи сохраняются в таблице `server_logs` с сервисом `'image-processing'`:

```sql
-- Все логи обработки изображений
SELECT * FROM server_logs 
WHERE service = 'image-processing' 
ORDER BY created_at DESC 
LIMIT 100;

-- Только ошибки
SELECT * FROM server_logs 
WHERE service = 'image-processing' 
AND level = 'error'
ORDER BY created_at DESC;

-- Логи конкретного клиента
SELECT * FROM server_logs 
WHERE service = 'image-processing' 
AND metadata->>'clientId' = '123'
ORDER BY created_at DESC;
```

### 2. В консоли сервера

Все логи также выводятся в консоль с метками:
- `[INFO]` - информационные сообщения
- `[DEBUG]` - отладочная информация
- `[ERROR]` - ошибки
- `[WARN]` - предупреждения

Пример:
```
[2025-01-26T10:30:00.000Z] [INFO] [image-processing] Начало обработки изображения
[2025-01-26T10:30:01.000Z] [INFO] [image-processing] Изображение успешно загружено
[2025-01-26T10:30:03.000Z] [INFO] [image-processing] Изображение успешно обработано и сохранено
```

### 3. Через API (если реализован endpoint для просмотра логов)

```javascript
GET /api/admin/logs?service=image-processing
```

## Что логируется

### Этапы обработки изображения

1. **Начало обработки** (`stage: 'start'`)
   - URL изображения
   - Метод обработки
   - Артикул товара
   - ID клиента

2. **Загрузка изображения** (`stage: 'download_start'`, `download_complete`)
   - URL источника
   - Размер файла
   - Время загрузки

3. **Обработка** (`stage: 'processing'`, `process_start`, `process_complete`)
   - Метод обработки
   - Размеры изображения
   - Время обработки
   - Размер выходного файла

4. **Сохранение** (`stage: 'complete'`)
   - Путь к файлу
   - Публичный URL
   - Статистика сжатия
   - Общее время обработки

5. **Ошибки** (`stage: 'error'`, `download_error`, `process_error`)
   - Сообщение об ошибке
   - Stack trace
   - Время до ошибки

### Статистика

В конце обработки батча логируется сводная статистика:
- Общее количество обработанных изображений
- Успешно обработанные
- Ошибки
- Процент успеха
- Среднее время обработки

Пример метаданных в логе:
```json
{
  "clientId": 123,
  "totalProducts": 150,
  "imagesFound": 140,
  "imageProcessing": {
    "total": 140,
    "processed": 135,
    "failed": 5,
    "skipped": 0,
    "successRate": "96.4%",
    "serviceStats": {
      "totalProcessed": 140,
      "totalSuccess": 135,
      "totalFailed": 5,
      "avgTime": "2500ms"
    }
  }
}
```

## Уровни логирования

- **INFO** - Основные события (начало/конец обработки, сохранение)
- **DEBUG** - Детальная информация о каждом этапе
- **ERROR** - Ошибки при обработке
- **WARN** - Предупреждения (не критичные проблемы)

## Примеры логов

### Успешная обработка

```
[INFO] [image-processing] Начало обработки изображения
  metadata: {
    imageUrl: "https://sima-land.ru/img/product.jpg",
    method: "auto",
    productArticle: "12345",
    clientId: 1,
    stage: "start"
  }

[INFO] [image-processing] Изображение успешно загружено
  metadata: {
    size: "245.32 KB",
    downloadTime: "1200ms"
  }

[INFO] [image-processing] Обработка изображения методом: auto
  metadata: {
    method: "auto",
    stage: "processing"
  }

[INFO] [image-processing] Изображение успешно обработано и сохранено
  metadata: {
    filename: "processed-1234567890-abc123.png",
    originalSize: "245.32 KB",
    processedSize: "180.45 KB",
    compression: "26.4%",
    totalTime: "3500ms",
    stats: {
      totalProcessed: 50,
      totalSuccess: 49,
      totalFailed: 1,
      avgTime: "3200ms"
    }
  }
```

### Ошибка обработки

```
[ERROR] [image-processing] Ошибка обработки изображения
  metadata: {
    imageUrl: "https://sima-land.ru/img/product.jpg",
    method: "auto",
    error: "Failed to download image: timeout",
    totalTime: "30000ms",
    stage: "error"
  }
```

## Мониторинг производительности

Логи включают метрики производительности:
- Время загрузки изображения
- Время обработки
- Время сохранения
- Общее время
- Среднее время обработки
- Процент успеха

## Получение статистики программно

```javascript
const imageProcessingService = require('./services/imageProcessingService');

// Получить текущую статистику
const stats = imageProcessingService.getStats();
console.log(stats);
// {
//   totalProcessed: 150,
//   totalSuccess: 145,
//   totalFailed: 5,
//   successRate: "96.7%",
//   avgTime: "2800ms"
// }

// Сбросить статистику
imageProcessingService.resetStats();
```

## Рекомендации

1. **Мониторинг** - Регулярно проверяйте логи на ошибки
2. **Производительность** - Следите за средним временем обработки
3. **Процент успеха** - Если успех < 90%, проверьте причины ошибок
4. **Хранилище** - Логи в БД могут занимать много места, настройте ротацию

## Очистка старых логов

```sql
-- Удалить логи старше 30 дней
DELETE FROM server_logs 
WHERE service = 'image-processing' 
AND created_at < NOW() - INTERVAL '30 days';
```

