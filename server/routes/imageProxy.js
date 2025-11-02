const express = require('express');
const https = require('https');
const http = require('http');

const router = express.Router();

console.log('[IMAGE PROXY] 🔧 Registering route: GET /sima-land/image-proxy');

// Тестовый маршрут для проверки
router.get('/test-image-proxy', (req, res) => {
  console.log('[IMAGE PROXY] ✅ Test route called!');
  res.json({ message: 'Image proxy router is working!' });
});

// Публичный прокси для изображений Sima Land (обход CORS)
// Этот маршрут доступен без аутентификации
router.get('/sima-land/image-proxy', async (req, res) => {
  console.log(`[IMAGE PROXY] 🎯 Route handler called! Query:`, req.query);
  console.log(`[IMAGE PROXY] 🎯 Full URL:`, req.url);
  console.log(`[IMAGE PROXY] 🎯 Method:`, req.method);
  console.log(`[IMAGE PROXY] 🎯 Path:`, req.path);
  
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

    // Загружаем изображение
    const protocol = imageUrl.startsWith('https') ? https : http;
    
    protocol.get(imageUrl, (imageResponse) => {
      // Проверяем статус ответа
      if (imageResponse.statusCode !== 200) {
        console.error(`[IMAGE PROXY] Error: status ${imageResponse.statusCode} for ${imageUrl}`);
        return res.status(imageResponse.statusCode).json({ error: 'Ошибка загрузки изображения' });
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
      res.status(500).json({ error: 'Ошибка загрузки изображения' });
    });
  } catch (error) {
    console.error('[IMAGE PROXY] Error:', error);
    res.status(500).json({ error: 'Ошибка проксирования изображения' });
  }
});

module.exports = router;

