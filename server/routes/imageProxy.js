const express = require('express');
const https = require('https');
const http = require('http');

const router = express.Router();

// Простое in-memory кеширование для изображений
// Ключ: URL изображения, Значение: { buffer, contentType, timestamp, isError }
const imageCache = new Map();
const MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 часа в миллисекундах
const MAX_CACHE_SIZE = 100; // Максимальное количество изображений в кеше

// Глобальная очередь и управление rate limiting
let requestQueue = [];
let isProcessingQueue = false;
let lastRequestTime = 0;
let rateLimitResetTime = 0; // Время когда сбросится rate limit
let activeRequests = 0; // Количество активных запросов
const MIN_REQUEST_INTERVAL = 70; // Минимальная задержка между запросами (мс) - ~14 запросов/сек для лимита в 15
const MAX_CONCURRENT_REQUESTS = 5; // Максимальное количество одновременных запросов
const RATE_LIMIT_WINDOW = 1000; // Окно для rate limit (1 секунда)

// Функция для обработки очереди запросов
async function processRequestQueue() {
  if (isProcessingQueue) {
    return;
  }
  
  isProcessingQueue = true;
  
  while (requestQueue.length > 0 && activeRequests < MAX_CONCURRENT_REQUESTS) {
    const now = Date.now();
    
    // Проверяем rate limit
    if (now < rateLimitResetTime) {
      const waitTime = rateLimitResetTime - now;
      console.log(`[IMAGE PROXY] ⏳ Rate limit active, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      continue;
    }
    
    // Проверяем минимальный интервал между запросами
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    const { urlToTry, options, resolve, reject, res: responseObj, cacheKey: reqCacheKey, imageUrl: reqImageUrl } = requestQueue.shift();
    lastRequestTime = Date.now();
    activeRequests++;
    
    const protocol = urlToTry.startsWith('https') ? https : http;
    const req = protocol.get(urlToTry, options, async (imageResponse) => {
      activeRequests--;
      
      // Обрабатываем ответ
      await handleQueueResponse(imageResponse, urlToTry, responseObj, reqCacheKey, reqImageUrl);
      resolve();
      
      // Продолжаем обработку очереди
      setTimeout(() => processRequestQueue(), 0);
    });
    
    req.on('error', (error) => {
      activeRequests--;
      console.error(`[IMAGE PROXY] Error proxying image ${urlToTry}:`, error.message);
      
      // Возвращаем placeholder
      const placeholderSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1" height="1" xmlns="http://www.w3.org/2000/svg">
  <rect width="1" height="1" fill="#f3f4f6"/>
</svg>`;
      const placeholderBuffer = Buffer.from(placeholderSvg);
      
      responseObj.setHeader('Content-Type', 'image/svg+xml');
      responseObj.setHeader('Content-Length', placeholderBuffer.length);
      responseObj.setHeader('Cache-Control', 'public, max-age=3600');
      responseObj.setHeader('Access-Control-Allow-Origin', '*');
      responseObj.setHeader('X-Image-Error', '500');
      responseObj.status(200).send(placeholderBuffer);
      
      reject(error);
      setTimeout(() => processRequestQueue(), 0);
    });
  }
  
  isProcessingQueue = false;
}

// Функция для обработки ответа из очереди
async function handleQueueResponse(imageResponse, urlToTry, res, cacheKey, imageUrl) {
  console.error(`[IMAGE PROXY] 📥 Response from Sima Land: status ${imageResponse.statusCode}`);
  
  if (imageResponse.statusCode !== 200) {
    console.error(`[IMAGE PROXY] ❌ Error: status ${imageResponse.statusCode} for ${urlToTry}`);
    
    // Обработка 429
    if (imageResponse.statusCode === 429) {
      const rateLimitReset = imageResponse.headers['x-rate-limit-reset'] || '1';
      const resetSeconds = parseInt(rateLimitReset) || 1;
      const resetTime = Date.now() + (resetSeconds * 1000);
      
      if (resetTime > rateLimitResetTime) {
        rateLimitResetTime = resetTime;
      }
      
      const placeholderSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1" height="1" xmlns="http://www.w3.org/2000/svg">
  <rect width="1" height="1" fill="#f3f4f6"/>
</svg>`;
      const placeholderBuffer = Buffer.from(placeholderSvg);
      
      imageCache.set(cacheKey, {
        buffer: placeholderBuffer,
        contentType: 'image/svg+xml',
        timestamp: Date.now(),
        isError: true,
        errorCode: 429,
        resetTime: resetTime
      });
      
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Content-Length', placeholderBuffer.length);
      res.setHeader('Cache-Control', `public, max-age=${resetSeconds}`);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('X-Image-Error', '429');
      res.setHeader('Retry-After', String(resetSeconds));
      res.status(200).send(placeholderBuffer);
      return;
    }
    
    // Другие ошибки
    const placeholderSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1" height="1" xmlns="http://www.w3.org/2000/svg">
  <rect width="1" height="1" fill="#f3f4f6"/>
</svg>`;
    const placeholderBuffer = Buffer.from(placeholderSvg);
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Content-Length', placeholderBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Image-Error', String(imageResponse.statusCode));
    res.status(200).send(placeholderBuffer);
    return;
  }
  
  // Успешный ответ
  const contentType = imageResponse.headers['content-type'] || 'image/jpeg';
  const chunks = [];
  
  imageResponse.on('data', (chunk) => {
    chunks.push(chunk);
  });
  
  imageResponse.on('end', () => {
    const imageBuffer = Buffer.concat(chunks);
    
    // Сохраняем в кеш
    imageCache.set(cacheKey, {
      buffer: imageBuffer,
      contentType: contentType,
      timestamp: Date.now(),
      isError: false
    });
    
    // Ограничиваем размер кеша
    if (imageCache.size > MAX_CACHE_SIZE) {
      const firstKey = imageCache.keys().next().value;
      imageCache.delete(firstKey);
    }
    
    console.log(`[IMAGE PROXY] ✅ Proxying image successfully: ${urlToTry.substring(0, 80)}... (Size: ${imageBuffer.length} bytes)`);
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Length', imageBuffer.length);
    res.send(imageBuffer);
  });
}

console.log('[IMAGE PROXY] 🔧 Registering route: GET /sima-land/image-proxy');

// Тестовый маршрут для проверки
router.get('/test-image-proxy', (req, res) => {
  console.log('[IMAGE PROXY]  Test route called!');
  res.json({ message: 'Image proxy router is working!' });
});

// Публичный прокси для изображений Sima Land (обход CORS)
// Этот маршрут доступен без аутентификации
router.get('/sima-land/image-proxy', async (req, res) => {
  // КРИТИЧЕСКИ ВАЖНО: Логируем ВСЕГДА, даже если потом будет ошибка
  console.error(`[IMAGE PROXY] ========== ROUTE HANDLER CALLED ==========`);
  console.error(`[IMAGE PROXY] Query:`, req.query);
  console.error(`[IMAGE PROXY] Full URL:`, req.url);
  console.error(`[IMAGE PROXY] Method:`, req.method);
  console.error(`[IMAGE PROXY] Path:`, req.path);
  
  try {
    let imageUrl = req.query.url;
    
    console.log(`[IMAGE PROXY] 📥 Received request with url param (raw):`, imageUrl);
    console.log(`[IMAGE PROXY] 📥 Query object:`, JSON.stringify(req.query));
    
    if (!imageUrl) {
      console.error(`[IMAGE PROXY] ❌ No URL parameter provided`);
      return res.status(400).json({ error: 'URL параметр обязателен' });
    }

    // Проверяем, не закодирован ли URL дважды
    // Express обычно автоматически декодирует query параметры, но иногда может быть двойное кодирование
    // Если URL содержит закодированные символы (например, %3A вместо :), попробуем декодировать
    if (typeof imageUrl === 'string' && (imageUrl.includes('%3A') || imageUrl.includes('%2F'))) {
      // Проверяем, если это похоже на двойное кодирование (URL не начинается с http:// или https://)
      if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
        console.log(`[IMAGE PROXY] 🔄 URL appears to be encoded, attempting to decode...`);
        console.log(`[IMAGE PROXY]   Before decode: ${imageUrl.substring(0, 100)}`);
        try {
          imageUrl = decodeURIComponent(imageUrl);
          console.log(`[IMAGE PROXY]   After decode: ${imageUrl.substring(0, 100)}`);
        } catch (decodeError) {
          console.error(`[IMAGE PROXY] ❌ Failed to decode URL:`, decodeError.message);
          // Продолжаем с оригинальным URL
        }
      }
    }

    // Убеждаемся, что URL начинается с http:// или https://
    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      console.error(`[IMAGE PROXY] ❌ Invalid URL format (must start with http:// or https://):`, imageUrl);
      return res.status(400).json({ error: 'Некорректный формат URL' });
    }

    // Проверяем, что URL принадлежит Sima Land (безопасность)
    if (!imageUrl.includes('sima-land') && !imageUrl.includes('goods-photos.static1-sima-land.com')) {
      console.error(`[IMAGE PROXY] ❌ URL not from Sima Land:`, imageUrl);
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    console.log(`[IMAGE PROXY] 🔄 Request to proxy image: ${imageUrl}`);

    // Загружаем изображение с заголовками для обхода защиты Sima Land
    // Важно: используем полный набор заголовков браузера для имитации реального запроса
    const protocol = imageUrl.startsWith('https') ? https : http;
    
    const urlObj = new URL(imageUrl);
    const origin = `${urlObj.protocol}//${urlObj.hostname}`;
    
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.sima-land.ru/',
        'Origin': 'https://www.sima-land.ru',
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'cross-site',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    };
    
    console.log(`[IMAGE PROXY] 🔍 Request headers:`, JSON.stringify(options.headers, null, 2));
    
    // Проверяем кеш перед запросом
    const cacheKey = imageUrl;
    const cached = imageCache.get(cacheKey);
    if (cached) {
      const cacheAge = Date.now() - cached.timestamp;
      
      // Если это кешированная ошибка 429, проверяем время reset
      if (cached.isError && cached.errorCode === 429) {
        const resetTime = cached.resetTime || (Date.now() + 60000); // По умолчанию 1 минута
        if (Date.now() < resetTime) {
          console.log(`[IMAGE PROXY] ⚠️ Serving 429 placeholder from cache: ${imageUrl.substring(0, 80)}...`);
          // Обновляем глобальное время reset rate limit
          if (resetTime > rateLimitResetTime) {
            rateLimitResetTime = resetTime;
          }
          res.setHeader('Content-Type', 'image/svg+xml');
          res.setHeader('Content-Length', cached.buffer.length);
          res.setHeader('Cache-Control', `public, max-age=${Math.ceil((resetTime - Date.now()) / 1000)}`);
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('X-Image-Cached', 'true');
          res.setHeader('X-Image-Error', '429');
          res.setHeader('Retry-After', String(Math.ceil((resetTime - Date.now()) / 1000)));
          return res.send(cached.buffer);
        } else {
          // Время reset истекло, удаляем из кеша и пробуем снова
          imageCache.delete(cacheKey);
        }
      } else if (!cached.isError && cacheAge < MAX_CACHE_AGE) {
        // Успешно закешированное изображение
        console.log(`[IMAGE PROXY] ✅ Serving from cache: ${imageUrl.substring(0, 80)}...`);
        res.setHeader('Content-Type', cached.contentType);
        res.setHeader('Content-Length', cached.buffer.length);
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Кеш на 24 часа
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Image-Cached', 'true');
        return res.send(cached.buffer);
      } else if (cacheAge >= MAX_CACHE_AGE) {
        // Кеш устарел, удаляем
        imageCache.delete(cacheKey);
      }
    }
    
    // Подготавливаем URL - добавляем ?v= если нужно
    let urlToTry = imageUrl;
    if (!urlToTry.includes('?v=') && urlToTry.includes('goods-photos.static1-sima-land.com') && urlToTry.endsWith('.jpg')) {
      // Извлекаем timestamp из URL (последнее число перед .jpg в пути)
      const urlMatch = urlToTry.match(/\/(\d+)\.jpg$/);
      if (urlMatch) {
        const versionNum = parseInt(urlMatch[1]);
        // Если число выглядит как Unix timestamp (>= 1000000000)
        if (versionNum >= 1000000000 && versionNum <= 9999999999) {
          urlToTry = `${urlToTry}?v=${versionNum}`;
        } else {
          // Используем текущий timestamp
          urlToTry = `${urlToTry}?v=${Math.floor(Date.now() / 1000)}`;
        }
      } else {
        urlToTry = `${urlToTry}?v=${Math.floor(Date.now() / 1000)}`;
      }
    }
    
    // Добавляем запрос в очередь
    const requestPromise = new Promise((resolve, reject) => {
      requestQueue.push({
        urlToTry: urlToTry,
        options: options,
        resolve: resolve,
        reject: reject,
        res: res,
        cacheKey: cacheKey,
        imageUrl: imageUrl
      });
    });
    
    // Запускаем обработку очереди (не блокируем, если уже обрабатывается)
    processRequestQueue().catch(err => {
      console.error('[IMAGE PROXY] Error processing queue:', err);
    });
    
    // Ждем выполнения запроса
    await requestPromise;
  } catch (error) {
    console.error('[IMAGE PROXY] Error:', error);
    
    // Возвращаем placeholder изображение вместо JSON
    const placeholderSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1" height="1" xmlns="http://www.w3.org/2000/svg">
  <rect width="1" height="1" fill="#f3f4f6"/>
</svg>`;
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Content-Length', Buffer.byteLength(placeholderSvg));
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Image-Error', '500');
    res.status(200).send(placeholderSvg);
  }
});

module.exports = router;

