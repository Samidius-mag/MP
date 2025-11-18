class MinecraftService {
  constructor() {
    this.players = new Map(); // Хранилище активных игроков
    this.server = null;
    this.isRunning = false;
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

