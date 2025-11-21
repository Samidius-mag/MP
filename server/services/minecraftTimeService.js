/**
 * Сервис для отображения статистики игроков в Minecraft
 * Отображает количество убийств (KILL) и смертей (DEAD) в scoreboard
 */

class MinecraftTimeService {
  constructor() {
    this.updateInterval = null;
    this.isRunning = false;
    this.updateIntervalMs = 2000; // Обновление каждые 2 секунды (чтобы сервер успевал обработать команды)
    this.sendCommandFn = null; // Функция для отправки команд
  }

  /**
   * Запускает сервис обновления статистики
   * @param {Function} sendCommandFn - Функция для отправки команд в сервер
   */
  start(sendCommandFn) {
    if (this.isRunning) {
      console.log('📊 Minecraft stats service is already running');
      return;
    }

    if (!sendCommandFn) {
      console.error('❌ sendCommand function is required to start stats service');
      return;
    }

    this.sendCommandFn = sendCommandFn;

    console.log('📊 Starting Minecraft stats display service...');
    
    // Инициализируем scoreboard при первом запуске
    this.initializeScoreboard();
    
    // Запускаем периодическое обновление статистики
    this.updateInterval = setInterval(() => {
      this.updateTimeDisplay();
    }, this.updateIntervalMs);

    this.isRunning = true;
    console.log('✅ Minecraft stats display service started');
  }

  /**
   * Останавливает сервис обновления статистики
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    this.isRunning = false;
    console.log('⏹️  Minecraft stats display service stopped');
  }

  /**
   * Инициализирует scoreboard для отображения статистики
   */
  initializeScoreboard() {
    if (!this.sendCommandFn) {
      console.error('❌ sendCommand function is not available');
      return;
    }

    try {
      // Создаем scoreboard для статистики, если его еще нет
      this.sendCommandFn('scoreboard objectives add gametime_display dummy "Статистика"');
    } catch (e) {
      // Scoreboard уже существует, это нормально
    }
    
    // Создаем отдельные scoreboard для статистики убийств и смертей
    // Используем встроенные типы статистики Minecraft
    try {
      this.sendCommandFn('scoreboard objectives add KILL stat.killEntity "KILL"');
    } catch (e) {
      // Scoreboard уже существует
    }
    
    try {
      this.sendCommandFn('scoreboard objectives add DEAD stat.deaths "DEAD"');
    } catch (e) {
      // Scoreboard уже существует
    }
    
    // Устанавливаем scoreboard статистики в sidebar справа
    // Используем gametime_display для отображения общей статистики
    this.sendCommandFn('scoreboard objectives setdisplay sidebar gametime_display');
    
    // Инициализируем переменные для суммирования статистики
    this.sendCommandFn('scoreboard players set #total_kills gametime_display 0');
    this.sendCommandFn('scoreboard players set #total_deaths gametime_display 0');
    
    console.log('✅ Stats scoreboard initialized');
  }

  /**
   * Обновляет отображение статистики (KILL и DEAD) в scoreboard
   */
  updateTimeDisplay() {
    if (!this.sendCommandFn) {
      return;
    }

    try {
      // Обновляем статистику для всех игроков
      // Scoreboard с типом stat.killEntity и stat.deaths автоматически обновляется Minecraft
      // Нам нужно только суммировать статистику всех игроков и отобразить в основном scoreboard
      
      // Инициализируем общие счетчики
      this.sendCommandFn('scoreboard players set #total_kills gametime_display 0');
      this.sendCommandFn('scoreboard players set #total_deaths gametime_display 0');
      
      // Суммируем убийства всех игроков из scoreboard KILL
      this.sendCommandFn('execute as @a run scoreboard players operation #total_kills gametime_display += @s KILL');
      
      // Суммируем смерти всех игроков из scoreboard DEAD
      this.sendCommandFn('execute as @a run scoreboard players operation #total_deaths gametime_display += @s DEAD');
      
      // Отображаем общую статистику в основном scoreboard
      this.sendCommandFn('scoreboard players set KILL gametime_display 0');
      this.sendCommandFn('scoreboard players operation KILL gametime_display = #total_kills gametime_display');
      
      this.sendCommandFn('scoreboard players set DEAD gametime_display 0');
      this.sendCommandFn('scoreboard players operation DEAD gametime_display = #total_deaths gametime_display');
      
      // Удаляем старые строки времени, если они существуют
      this.sendCommandFn('scoreboard players reset GameTime gametime_display');
      this.sendCommandFn('scoreboard players reset Time gametime_display');
      this.sendCommandFn('scoreboard players reset Hour gametime_display');
      this.sendCommandFn('scoreboard players reset Min gametime_display');
      this.sendCommandFn('scoreboard players reset AMPM gametime_display');
      
    } catch (error) {
      // Игнорируем ошибки, чтобы не спамить логи
      // console.error('Error updating stats display:', error);
    }
  }

  /**
   * Форматирует игровое время в читаемый формат
   * @param {number} gameTime - Время игры (0-24000)
   * @returns {string} Отформатированное время (например, "12:30")
   */
  formatGameTime(gameTime) {
    // Игровое время: 0 = рассвет, 6000 = полдень, 12000 = закат, 18000 = полночь
    // Один игровой день = 24000 тиков = 20 минут реального времени
    
    // Вычисляем часы (0-23)
    const hours = Math.floor((gameTime / 1000) % 24);
    
    // Вычисляем минуты (0-59)
    const minutes = Math.floor(((gameTime % 1000) / 1000) * 60);
    
    // Форматируем с ведущими нулями
    const hoursStr = hours.toString().padStart(2, '0');
    const minutesStr = minutes.toString().padStart(2, '0');
    
    return `${hoursStr}:${minutesStr}`;
  }

  /**
   * Получает текущее время игрового мира
   * @returns {Promise<number>} Время игры (0-24000)
   */
  async getGameTime() {
    // В vanilla сервере можно получить время через команду
    // Но для этого нужно парсить вывод команды
    // Проще использовать datapack, который автоматически обновляет scoreboard
    return null;
  }
}

module.exports = new MinecraftTimeService();

