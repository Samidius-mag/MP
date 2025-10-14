const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/client');
const operatorRoutes = require('./routes/operator');
const adminRoutes = require('./routes/admin');
const marketplaceRoutes = require('./routes/marketplace');
const paymentRoutes = require('./routes/payment');
const { router: notificationRoutes } = require('./routes/notification');
// const testWbRoutes = require('./routes/test-wb');

const { connectDB } = require('./config/database');
const { errorHandler } = require('./middleware/errorHandler');
const { authenticateToken } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// Подключение к базе данных
connectDB();

// Middleware
// Приложение работает за Nginx reverse proxy — доверяем заголовкам X-Forwarded-*
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100 // максимум 100 запросов с одного IP за 15 минут
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/client', authenticateToken, clientRoutes);
app.use('/api/operator', authenticateToken, operatorRoutes);
app.use('/api/admin', authenticateToken, adminRoutes);
app.use('/api/marketplace', authenticateToken, marketplaceRoutes);
app.use('/api/payment', authenticateToken, paymentRoutes);
app.use('/api/notification', authenticateToken, notificationRoutes);
// app.use('/api/test-wb', testWbRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
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

module.exports = app;

