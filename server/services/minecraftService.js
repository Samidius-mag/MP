const { Pool } = require('pg');
const logger = require('./logger');

class MinecraftService {
  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'dropshipping_db',
      user: process.env.DB_USER || 'dropshipping',
      password: process.env.DB_PASSWORD || 'KeyOfWorld2025',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.players = new Map(); // Хранилище активных игроков
    this.server = null;
    this.isRunning = false;
  }

  /**
   * Получает список всех игроков
   */
  async getPlayers() {
    try {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          `SELECT id, username, uuid, last_seen, total_playtime, created_at 
           FROM minecraft_players 
           ORDER BY last_seen DESC`
        );
        return result.rows;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('Error getting players:', err);
      throw err;
    }
  }

  /**
   * Сохраняет или обновляет информацию об игроке
   */
  async savePlayer(username, uuid, metadata = {}) {
    try {
      const client = await this.pool.connect();
      try {
        await client.query(
          `INSERT INTO minecraft_players (username, uuid, last_seen, metadata)
           VALUES ($1, $2, NOW(), $3)
           ON CONFLICT (uuid) 
           DO UPDATE SET 
             username = EXCLUDED.username,
             last_seen = NOW(),
             metadata = EXCLUDED.metadata`,
          [username, uuid, JSON.stringify(metadata)]
        );
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('Error saving player:', err);
      throw err;
    }
  }

  /**
   * Логирует событие сервера
   */
  async logEvent(eventType, message, metadata = {}) {
    try {
      await logger.log('info', `[MINECRAFT] ${message}`, {
        service: 'minecraft',
        metadata: { eventType, ...metadata }
      });
    } catch (err) {
      console.error('Error logging minecraft event:', err);
    }
  }

  /**
   * Получает статистику сервера
   */
  getServerStats() {
    return {
      isRunning: this.isRunning,
      onlinePlayers: this.players.size,
      totalPlayers: Array.from(this.players.values())
    };
  }
}

module.exports = new MinecraftService();

