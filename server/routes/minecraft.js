const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const minecraftService = require('../services/minecraftService');
const { getServer, stopMinecraftServer, startMinecraftServer } = require('../minecraft-server');

const router = express.Router();

// Получение статистики сервера
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const stats = minecraftService.getServerStats();
    const players = await minecraftService.getPlayers();
    
    res.json({
      success: true,
      stats: {
        ...stats,
        totalPlayersInDB: players.length
      },
      onlinePlayers: Array.from(minecraftService.players.values()).map(p => ({
        username: p.username,
        uuid: p.uuid,
        connectedAt: p.connectedAt
      })),
      recentPlayers: players.slice(0, 10) // Последние 10 игроков
    });
  } catch (error) {
    console.error('Error getting Minecraft stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка получения статистики сервера' 
    });
  }
});

// Получение списка всех игроков
router.get('/players', requireAdmin, async (req, res) => {
  try {
    const players = await minecraftService.getPlayers();
    res.json({
      success: true,
      players,
      total: players.length
    });
  } catch (error) {
    console.error('Error getting players:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка получения списка игроков' 
    });
  }
});

// Перезапуск сервера
router.post('/restart', requireAdmin, async (req, res) => {
  try {
    const server = getServer();
    
    if (server) {
      stopMinecraftServer();
      
      // Ждем немного перед перезапуском
      setTimeout(() => {
        try {
          startMinecraftServer();
          res.json({ 
            success: true, 
            message: 'Сервер перезапущен' 
          });
        } catch (error) {
          console.error('Error restarting server:', error);
          res.status(500).json({ 
            success: false, 
            error: 'Ошибка перезапуска сервера' 
          });
        }
      }, 2000);
    } else {
      // Сервер не запущен, просто запускаем
      startMinecraftServer();
      res.json({ 
        success: true, 
        message: 'Сервер запущен' 
      });
    }
  } catch (error) {
    console.error('Error restarting Minecraft server:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка перезапуска сервера' 
    });
  }
});

// Остановка сервера
router.post('/stop', requireAdmin, async (req, res) => {
  try {
    const server = getServer();
    
    if (server) {
      stopMinecraftServer();
      res.json({ 
        success: true, 
        message: 'Сервер остановлен' 
      });
    } else {
      res.json({ 
        success: false, 
        message: 'Сервер не запущен' 
      });
    }
  } catch (error) {
    console.error('Error stopping Minecraft server:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка остановки сервера' 
    });
  }
});

// Запуск сервера
router.post('/start', requireAdmin, async (req, res) => {
  try {
    const server = getServer();
    
    if (server) {
      res.json({ 
        success: false, 
        message: 'Сервер уже запущен' 
      });
    } else {
      startMinecraftServer();
      res.json({ 
        success: true, 
        message: 'Сервер запущен' 
      });
    }
  } catch (error) {
    console.error('Error starting Minecraft server:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка запуска сервера' 
    });
  }
});

module.exports = router;

