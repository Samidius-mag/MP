const SimaLandService = require('../services/simaLandService');
const progressStore = require('../services/progressStore');
const { connectDB } = require('../config/database');

// Загружаем настройки
const fs = require('fs');
const path = require('path');
function loadEnvExample() {
  const envExamplePath = path.join(__dirname, '..', 'env.example');
  if (!fs.existsSync(envExamplePath)) return;
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
  Object.keys(config).forEach(key => {
    if (!process.env[key]) {
      process.env[key] = config[key];
    }
  });
}
loadEnvExample();

// Подключаемся к БД
connectDB();

const simaLandService = new SimaLandService();

async function updateCatalog() {
  const token = process.env.SIMA_LAND_STATIC_TOKEN;
  if (!token) {
    console.error(`❌ [${new Date().toISOString()}] SIMA_LAND_STATIC_TOKEN is not set`);
    return;
  }

  const jobId = progressStore.createJob('simaLandCatalogLoad', { categories: [], scheduled: true });
  console.log(`🔄 [${new Date().toISOString()}] Starting scheduled catalog update. JobId: ${jobId}`);
  
  try {
    await simaLandService.loadCatalog({ categories: [] }, jobId);
    const job = progressStore.getJob(jobId);
    console.log(`✅ [${new Date().toISOString()}] Catalog update completed. Saved: ${job?.result?.saved || 'unknown'}`);
  } catch (error) {
    console.error(`❌ [${new Date().toISOString()}] Catalog update failed:`, error.message);
    progressStore.failJob(jobId, error.message);
  }
}

// Первый запуск через 30 секунд после старта
setTimeout(() => {
  console.log(`🚀 [${new Date().toISOString()}] First catalog update on startup...`);
  updateCatalog();
}, 30000);

// Запуск каждые 5 часов
const cron = require('node-cron');
cron.schedule('0 */5 * * *', () => {
  console.log(`⏰ [${new Date().toISOString()}] Scheduled catalog update triggered`);
  updateCatalog();
});

console.log(`📋 [${new Date().toISOString()}] Sima-land catalog updater started. Schedule: every 5 hours. First update in 30 seconds.`);

// Держим процесс живым
process.on('SIGINT', () => {
  console.log(`SIGINT received, shutting down...`);
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(`SIGTERM received, shutting down...`);
  process.exit(0);
});

