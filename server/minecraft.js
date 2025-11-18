#!/usr/bin/env node

/**
 * Отдельный файл для запуска Minecraft сервера через PM2
 * Запуск: node server/minecraft.js
 * Или через PM2: pm2 start server/minecraft.js --name minecraft-server
 */

const fs = require('fs');
const path = require('path');

// Загружаем настройки из env.example (как в index.js)
function loadEnvExample() {
  const envExamplePath = path.join(__dirname, 'env.example');
  if (fs.existsSync(envExamplePath)) {
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
  return {};
}

// Загружаем настройки
loadEnvExample();

const { startMinecraftServer } = require('./minecraft-server');

console.log('🎮 Starting Minecraft server as standalone process...');

try {
  startMinecraftServer();
  console.log('✅ Minecraft server started successfully');
} catch (error) {
  console.error('❌ Failed to start Minecraft server:', error);
  process.exit(1);
}

