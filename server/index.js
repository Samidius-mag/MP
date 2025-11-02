const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');

// Загружаем настройки из env.example
function loadEnvExample() {
  const envExamplePath = path.join(__dirname, 'env.example');
  const envContent = fs.readFileSync(envExamplePath, 'utf8');
  
  const config = {};
  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        config[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  
  // Устанавливаем переменные окружения
  Object.keys(config).forEach(key => {
    if (!process.env[key]) {
      process.env[key] = config[key];
    }
  });
  
  return config;
}

// Загружаем настройки
loadEnvExample();

const authRoutes = require('./routes/auth');
const simaRoutes = require('./routes/sima');
const clientRoutes = require('./routes/client');
const operatorRoutes = require('./routes/operator');
const adminRoutes = require('./routes/admin');
const marketplaceRoutes = require('./routes/marketplace');
const paymentRoutes = require('./routes/payment');
const { router: notificationRoutes } = require('./routes/notification');
const pricingRoutes = require('./routes/pricing');
const warehouseRoutes = require('./routes/warehouse');
const apiRoutes = require('./routes/api');
// const testWbRoutes = require('./routes/test-wb');

const { connectDB } = require('./config/database');
const { errorHandler } = require('./middleware/errorHandler');
const { authenticateToken } = require('./middleware/auth');
const requestLogger = require('./middleware/requestLogger');
const logger = require('./services/logger');

const app = express();
const PORT = process.env.PORT || 3001;

// Validate critical configuration
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set in environment variables. Exiting.');
  process.exit(1);
}

// Подключение к базе данных
connectDB();

// Middleware
// Приложение работает за Nginx reverse proxy — доверяем заголовкам X-Forwarded-*
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: [
    process.env.CLIENT_URL || 'http://localhost:3000',
    'https://vgk-perv.ru',
    'https://www.vgk-perv.ru'
  ],
  credentials: true
}));

// Rate limiting (ослабим для эндпоинта статуса импорта и health)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // максимум 100 запросов с одного IP за 15 минут
  skip: (req) => {
    const p = req.path || '';
    return p === '/api/health' || p.startsWith('/api/client/sima-land/products/status');
  }
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use(requestLogger);

// Статическая отдача обработанных изображений
app.use('/uploads/products', express.static(path.join(__dirname, 'uploads', 'products')));

// Routes
// Публичные сервисные маршруты (без JWT)
app.use('/api', simaRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/client', authenticateToken, clientRoutes);
app.use('/api/operator', authenticateToken, operatorRoutes);
app.use('/api/admin', authenticateToken, adminRoutes);
app.use('/api/marketplace', authenticateToken, marketplaceRoutes);
app.use('/api/payment', authenticateToken, paymentRoutes);
app.use('/api/notification', authenticateToken, notificationRoutes);
app.use('/api/pricing', authenticateToken, pricingRoutes);
app.use('/api/warehouse', authenticateToken, warehouseRoutes);
app.use('/api/external', apiRoutes);
// app.use('/api/test-wb', testWbRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Статический файл для звука уведомлений
app.get('/alarm.mp3', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const filePath = path.join(__dirname, '..', 'alarm.mp3');
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Sound file not found' });
  }
});

// Favicon
app.get('/favicon.ico', (req, res) => {
  res.status(204).end(); // No Content
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});

// Автоимпорт заказов раз в час
try {
  const cron = require('node-cron');
  const { autoImportOrders } = require('./services/importer');
  // Запускаем каждые 5 минут
  cron.schedule('*/5 * * * *', async () => {
    try {
      console.log('⏰ Running orders import (every 5 minutes)');
      await autoImportOrders();
    } catch (e) {
      console.error('Scheduled import failed:', e.message);
    }
  });
  console.log('🗓️  Cron job scheduled: */5 * * * * (every 5 minutes)');
  console.log('🌐 Server timezone (process.env.TZ):', process.env.TZ || 'not set');
  // Разовый запуск через 5 секунд после старта для проверки
  setTimeout(async () => {
    try {
      console.log('🚀 One-off import run after startup');
      await autoImportOrders();
      console.log('✅ One-off import run completed');
    } catch (e) {
      console.error('One-off import failed:', e.message);
    }
  }, 5000);
} catch (e) {
  console.error('Cron setup failed:', e.message);
}

// Запуск сервиса автоматизации ценообразования
try {
  const PricingAutomationService = require('./services/pricingAutomationService');
  const pricingAutomation = new PricingAutomationService();
  
  // Запускаем сервис автоматизации
  pricingAutomation.start();
  console.log('💰 Pricing automation service started');
} catch (e) {
  console.error('Pricing automation setup failed:', e.message);
}

module.exports = app;

