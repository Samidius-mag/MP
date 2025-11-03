const express = require('express');
const https = require('https');
const http = require('http');

const router = express.Router();

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
    const imageUrl = req.query.url;
    
    console.log(`[IMAGE PROXY] 📥 Received request with url param:`, imageUrl);
    
    if (!imageUrl) {
      console.error(`[IMAGE PROXY] ❌ No URL parameter provided`);
      return res.status(400).json({ error: 'URL параметр обязателен' });
    }

    // Проверяем, что URL принадлежит Sima Land (безопасность)
    if (!imageUrl.includes('sima-land') && !imageUrl.includes('goods-photos.static1-sima-land.com')) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    console.log(`[IMAGE PROXY] 🔄 Request to proxy image: ${imageUrl.substring(0, 100)}...`);

    // Загружаем изображение с заголовками для обхода защиты Sima Land
    const protocol = imageUrl.startsWith('https') ? https : http;
    
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://www.sima-land.ru/',
        'Accept-Encoding': 'gzip, deflate, br'
      }
    };
    
    protocol.get(imageUrl, options, (imageResponse) => {
      console.error(`[IMAGE PROXY] 📥 Response from Sima Land: status ${imageResponse.statusCode}`);
      console.error(`[IMAGE PROXY]   Content-Type: ${imageResponse.headers['content-type']}`);
      console.error(`[IMAGE PROXY]   Content-Length: ${imageResponse.headers['content-length']}`);
      
      // Проверяем статус ответа
      if (imageResponse.statusCode !== 200) {
        console.error(`[IMAGE PROXY] ❌ Error: status ${imageResponse.statusCode} for ${imageUrl}`);
        console.error(`[IMAGE PROXY]   Response headers:`, JSON.stringify(imageResponse.headers));
        
        // Для 404 возвращаем SVG placeholder с информацией об ошибке
        // Это более понятно чем 1x1 PNG и фронтенд легко определит что это placeholder
        if (imageResponse.statusCode === 404) {
          console.error(`[IMAGE PROXY] 🔄 Returning SVG placeholder for 404`);
          
          // SVG placeholder с серым фоном - фронтенд легко определит это как ошибку
          const placeholderSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="300" fill="#f3f4f6"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="16" fill="#9ca3af" text-anchor="middle" dy=".3em">
    Изображение недоступно
  </text>
</svg>`;
          
          res.setHeader('Content-Type', 'image/svg+xml');
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('X-Image-Error', '404'); // Специальный заголовок для фронтенда
          res.status(404);
          return res.send(placeholderSvg);
        }
        
        // Для других ошибок также возвращаем SVG placeholder
        const placeholderSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="300" fill="#f3f4f6"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="16" fill="#9ca3af" text-anchor="middle" dy=".3em">
    Ошибка загрузки изображения
  </text>
</svg>`;
        
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Image-Error', String(imageResponse.statusCode));
        res.status(imageResponse.statusCode);
        return res.send(placeholderSvg);
      }

      // Устанавливаем заголовки
      const contentType = imageResponse.headers['content-type'] || 'image/jpeg';
      const contentLength = imageResponse.headers['content-length'];
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Кеш на 24 часа
      res.setHeader('Access-Control-Allow-Origin', '*'); // Разрешаем CORS
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }
      
      console.log(`[IMAGE PROXY] ✅ Proxying image successfully: ${imageUrl.substring(0, 80)}... (Content-Type: ${contentType}, Size: ${contentLength || 'unknown'})`);
      
      // Проксируем изображение
      imageResponse.pipe(res);
    }).on('error', (error) => {
      console.error(`[IMAGE PROXY] Error proxying image ${imageUrl}:`, error.message);
      
      // Возвращаем SVG placeholder вместо JSON ошибки
      const placeholderSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="300" fill="#f3f4f6"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="16" fill="#9ca3af" text-anchor="middle" dy=".3em">
    Ошибка загрузки изображения
  </text>
</svg>`;
      
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('X-Image-Error', '500');
      res.status(500);
      return res.send(placeholderSvg);
    });
  } catch (error) {
    console.error('[IMAGE PROXY] Error:', error);
    
    // Возвращаем SVG placeholder вместо JSON ошибки
    const placeholderSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="300" fill="#f3f4f6"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="16" fill="#9ca3af" text-anchor="middle" dy=".3em">
    Ошибка загрузки изображения
  </text>
</svg>`;
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Image-Error', '500');
    res.status(500);
    return res.send(placeholderSvg);
  }
});

module.exports = router;

