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
    
    // НЕ устанавливаем scoreboard в fsidebar, так как время будет в actionbar
    // Явно убираем scoreboard из sidebar, если он был установлен ранее
    this.sendCommandFn('scoreboard objectives setdisplay sidebar');
    
    // Устанавливаем константы для вычислений
    this.sendCommandFn('scoreboard players set #const_1000 gametime_display 1000');
    this.sendCommandFn('scoreboard players set #const_24 gametime_display 24');
    this.sendCommandFn('scoreboard players set #const_12 gametime_display 12');
    this.sendCommandFn('scoreboard players set #const_60 gametime_display 60');
    this.sendCommandFn('scoreboard players set #const_100 gametime_display 100');
    this.sendCommandFn('scoreboard players set #const_10 gametime_display 10');
    
    // Инициализируем переменные
    this.sendCommandFn('scoreboard players set #time gametime_display 0');
    this.sendCommandFn('scoreboard players set #hours24 gametime_display 0');
    this.sendCommandFn('scoreboard players set #hours12 gametime_display 0');
    this.sendCommandFn('scoreboard players set #minutes gametime_display 0');
    this.sendCommandFn('scoreboard players set #minutes_temp gametime_display 0');
    this.sendCommandFn('scoreboard players set #time_display gametime_display 0');
    this.sendCommandFn('scoreboard players set #min_tens gametime_display 0');
    this.sendCommandFn('scoreboard players set #min_ones gametime_display 0');
    
    console.log('✅ Time scoreboard initialized');
  }

  /**
   * Обновляет отображение времени в scoreboard в формате AM/PM
   */
  updateTimeDisplay() {
    if (!this.sendCommandFn) {
      return;
    }

    try {
      // Получаем текущее время дня (0-24000) и сохраняем в scoreboard
      this.sendCommandFn('execute store result score #time gametime_display run time query daytime');
      
      // Вычисляем игровые часы (0-23)
      // Формула: часы = (время / 1000) % 24
      this.sendCommandFn('scoreboard players operation #hours24 gametime_display = #time gametime_display');
      this.sendCommandFn('scoreboard players operation #hours24 gametime_display /= #const_1000 gametime_display');
      this.sendCommandFn('scoreboard players operation #hours24 gametime_display %= #const_24 gametime_display');
      
      // Вычисляем игровые минуты (0-59)
      // Формула: минуты = ((время % 1000) / 1000) * 60
      this.sendCommandFn('scoreboard players operation #minutes_temp gametime_display = #time gametime_display');
      this.sendCommandFn('scoreboard players operation #minutes_temp gametime_display %= #const_1000 gametime_display');
      this.sendCommandFn('scoreboard players operation #minutes_temp gametime_display *= #const_60 gametime_display');
      this.sendCommandFn('scoreboard players operation #minutes gametime_display = #minutes_temp gametime_display');
      this.sendCommandFn('scoreboard players operation #minutes gametime_display /= #const_1000 gametime_display');
      
      // Вычисляем часы в 12-часовом формате (1-12)
      // Если часы = 0, то 12 (полночь)
      // Если часы = 12, то 12 (полдень)
      // Если часы > 12, то часы - 12
      // Иначе часы (1-11)
      this.sendCommandFn('scoreboard players operation #hours12 gametime_display = #hours24 gametime_display');
      
      // Если часы = 0, устанавливаем 12
      this.sendCommandFn('execute if score #hours24 gametime_display matches 0 run scoreboard players set #hours12 gametime_display 12');
      
      // Если часы > 12, вычитаем 12
      this.sendCommandFn('execute if score #hours24 gametime_display matches 13.. run scoreboard players operation #hours12 gametime_display -= #const_12 gametime_display');
      
      // Определяем AM/PM (0 = AM, 1 = PM)
      // AM если часы < 12 (0-11), PM если часы >= 12 (12-23)
      this.sendCommandFn('scoreboard players set AMPM gametime_display 0');
      this.sendCommandFn('execute if score #hours24 gametime_display matches 12.. run scoreboard players set AMPM gametime_display 1');
      
      // Отображаем часы в scoreboard
      this.sendCommandFn('scoreboard players set Hour gametime_display 0');
      this.sendCommandFn('scoreboard players operation Hour gametime_display = #hours12 gametime_display');
      
      // Отображаем минуты в scoreboard (с ведущим нулем через вычисления)
      // Формируем минуты с ведущим нулем: если минуты < 10, добавляем 0
      this.sendCommandFn('scoreboard players set Min gametime_display 0');
      this.sendCommandFn('scoreboard players operation Min gametime_display = #minutes gametime_display');
      
      // Определяем AM/PM (0 = AM, 1 = PM)
      this.sendCommandFn('scoreboard players set AMPM gametime_display 1');
      this.sendCommandFn('execute if score #hours24 gametime_display matches 12.. run scoreboard players set AMPM gametime_display 0');
      
      // Отображаем время в actionbar в формате "HH:MM AM/PM"
      // Используем команду title actionbar с JSON для отображения текста
      // Формат: "10:30 AM" или "6:05 PM"
      // Добавляем ведущий ноль для минут, если они меньше 10
      
      // Вычисляем десятки минут для правильного отображения
      this.sendCommandFn('scoreboard players operation #min_tens gametime_display = #minutes gametime_display');
      this.sendCommandFn('scoreboard players operation #min_tens gametime_display /= #const_10 gametime_display');
      this.sendCommandFn('scoreboard players operation #min_ones gametime_display = #minutes gametime_display');
      this.sendCommandFn('scoreboard players operation #min_ones gametime_display %= #const_10 gametime_display');
      
      // Для AM (AMPM = 0) - показываем "AM" в actionbar
      // Используем упрощенный JSON формат для лучшей совместимости
      this.sendCommandFn('execute if score AMPM gametime_display matches 0 run title @a actionbar {"text":"","extra":[{"score":{"name":"Hour","objective":"gametime_display"},"color":"white"},{"text":":","color":"white"},{"score":{"name":"#min_tens","objective":"gametime_display"},"color":"white"},{"score":{"name":"#min_ones","objective":"gametime_display"},"color":"white"},{"text":" AM","color":"gray"}]}');
      
      // Для PM (AMPM = 1) - показываем "PM" в actionbar
      // Используем упрощенный JSON формат для лучшей совместимости
      this.sendCommandFn('execute if score AMPM gametime_display matches 1 run title @a actionbar {"text":"","extra":[{"score":{"name":"Hour","objective":"gametime_display"},"color":"white"},{"text":":","color":"white"},{"score":{"name":"#min_tens","objective":"gametime_display"},"color":"white"},{"score":{"name":"#min_ones","objective":"gametime_display"},"color":"white"},{"text":" PM","color":"gray"}]}');
      
      // Удаляем старые строки, если они существуют
      this.sendCommandFn('scoreboard players reset GameTime gametime_display');
      this.sendCommandFn('scoreboard players reset Time gametime_display');
      
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

