/**
 * Сервис для отображения времени игрового мира в Minecraft
 * Обновляет scoreboard с текущим временем игрового мира
 */

class MinecraftTimeService {
  constructor() {
    this.updateInterval = null;
    this.isRunning = false;
    this.updateIntervalMs = 2000; // Обновление каждые 2 секунды (чтобы сервер успевал обработать команды)
    this.sendCommandFn = null; // Функция для отправки команд
  }

  /**
   * Запускает сервис обновления времени
   * @param {Function} sendCommandFn - Функция для отправки команд в сервер
   */
  start(sendCommandFn) {
    if (this.isRunning) {
      console.log('⏰ Minecraft time service is already running');
      return;
    }

    if (!sendCommandFn) {
      console.error('❌ sendCommand function is required to start time service');
      return;
    }

    this.sendCommandFn = sendCommandFn;

    console.log('⏰ Starting Minecraft time display service...');
    
    // Инициализируем scoreboard при первом запуске
    this.initializeScoreboard();
    
    // Запускаем периодическое обновление
    this.updateInterval = setInterval(() => {
      this.updateTimeDisplay();
    }, this.updateIntervalMs);

    this.isRunning = true;
    console.log('✅ Minecraft time display service started');
  }

  /**
   * Останавливает сервис обновления времени
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
    console.log('⏹️  Minecraft time display service stopped');
  }

  /**
   * Инициализирует scoreboard для отображения времени
   */
  initializeScoreboard() {
    if (!this.sendCommandFn) {
      console.error('❌ sendCommand function is not available');
      return;
    }

    try {
      // Создаем scoreboard, если его еще нет
      this.sendCommandFn('scoreboard objectives add gametime_display dummy "⏰ Игровое время"');
    } catch (e) {
      // Scoreboard уже существует, это нормально
    }
    
    // Устанавливаем отображение scoreboard справа для всех игроков
    this.sendCommandFn('scoreboard objectives setdisplay sidebar gametime_display');
    
    // Устанавливаем константы для вычислений
    this.sendCommandFn('scoreboard players set #const_1000 gametime_display 1000');
    this.sendCommandFn('scoreboard players set #const_24 gametime_display 24');
    this.sendCommandFn('scoreboard players set #const_60 gametime_display 60');
    
    // Инициализируем переменные
    this.sendCommandFn('scoreboard players set #time gametime_display 0');
    this.sendCommandFn('scoreboard players set #hours gametime_display 0');
    this.sendCommandFn('scoreboard players set #minutes gametime_display 0');
    this.sendCommandFn('scoreboard players set #minutes_temp gametime_display 0');
    
    console.log('✅ Time scoreboard initialized');
  }

  /**
   * Обновляет отображение времени в scoreboard
   */
  updateTimeDisplay() {
    if (!this.sendCommandFn) {
      return;
    }

    try {
      // Используем команду execute store result score для получения времени
      // и сохранения его в scoreboard напрямую
      // Это работает даже если datapack не обновляет значения
      
      // Команда: execute store result score #time gametime_display run time query daytime
      // Сохраняет текущее время дня (0-24000) в score #time
      this.sendCommandFn('execute store result score #time gametime_display run time query daytime');
      
      // Обновляем отображение времени в scoreboard
      // Копируем значение из #time в "Время дня"
      this.sendCommandFn('scoreboard players set "Время дня" gametime_display 0');
      this.sendCommandFn('scoreboard players operation "Время дня" gametime_display = #time gametime_display');
      
    } catch (error) {
      // Игнорируем ошибки, чтобы не спамить логи
      // console.error('Error updating time display:', error);
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

