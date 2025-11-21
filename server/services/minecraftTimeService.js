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
      // Удаляем старый scoreboard, если он существует с неправильным названием
      this.sendCommandFn('scoreboard objectives remove gametime_display');
    } catch (e) {
      // Scoreboard не существует, это нормально
    }
    
    // Создаем новый scoreboard для статистики
    this.sendCommandFn('scoreboard objectives add gametime_display dummy "Статистика"');
    
    // Удаляем старые scoreboard статистики, если они существуют
    try {
      this.sendCommandFn('scoreboard objectives remove KILL');
    } catch (e) {
      // Scoreboard не существует, это нормально
    }
    
    try {
      this.sendCommandFn('scoreboard objectives remove DEAD');
    } catch (e) {
      // Scoreboard не существует, это нормально
    }
    
    // Создаем отдельные scoreboard для статистики убийств и смертей
    // Используем правильные критерии:
    // - deathCount - для количества смертей
    // Для убийств враждебных мобов используем отдельные scoreboard для каждого типа моба
    // и суммируем их в основной scoreboard
    this.sendCommandFn('scoreboard objectives add DEAD deathCount "Смертей"');
    
    // Создаем scoreboard для каждого типа враждебного моба
    // Список основных враждебных мобов: zombie, skeleton, spider, creeper, enderman, witch, etc.
    const hostileMobs = [
      'zombie', 'skeleton', 'spider', 'creeper', 'enderman', 'witch',
      'zombie_villager', 'husk', 'stray', 'cave_spider', 'silverfish',
      'endermite', 'shulker', 'phantom', 'drowned', 'pillager', 'vindicator',
      'evoker', 'vex', 'vindicator', 'ravager', 'piglin_brute', 'zoglin',
      'wither_skeleton', 'blaze', 'ghast', 'magma_cube', 'slime'
    ];
    
    // Создаем scoreboard для каждого типа враждебного моба
    hostileMobs.forEach(mob => {
      try {
        this.sendCommandFn(`scoreboard objectives add kill_${mob} minecraft.killed:minecraft.${mob}`);
      } catch (e) {
        // Scoreboard уже существует, это нормально
      }
    });
    
    // Создаем основной scoreboard для отображения общего количества убийств
    this.sendCommandFn('scoreboard objectives add KILL dummy "Убийства"');
    
    // Устанавливаем scoreboard статистики в sidebar справа
    // Отображаем индивидуальную статистику каждого игрока
    this.sendCommandFn('scoreboard objectives setdisplay sidebar KILL');
    
    // Инициализируем переменные для суммирования статистики
    this.sendCommandFn('scoreboard players set #total_kills gametime_display 0');
    this.sendCommandFn('scoreboard players set #total_deaths gametime_display 0');
    
    // Создаем константу для проверки кратности 10
    this.sendCommandFn('scoreboard players set #const_10 gametime_display 10');
    
    // Создаем временные переменные для проверки наград
    this.sendCommandFn('scoreboard players set #kills_temp gametime_display 0');
    this.sendCommandFn('scoreboard players set #kills_mod10 gametime_display 0');
    this.sendCommandFn('scoreboard players set #last_rewarded_temp gametime_display 0');
    
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
      // Сначала обновляем индивидуальную статистику каждого игрока
      // Затем суммируем общую статистику
      
      // Список враждебных мобов
      const hostileMobs = [
        'zombie', 'skeleton', 'spider', 'creeper', 'enderman', 'witch',
        'zombie_villager', 'husk', 'stray', 'cave_spider', 'silverfish',
        'endermite', 'shulker', 'phantom', 'drowned', 'pillager', 'vindicator',
        'evoker', 'vex', 'ravager', 'piglin_brute', 'zoglin',
        'wither_skeleton', 'blaze', 'ghast', 'magma_cube', 'slime'
      ];
      
      // Для каждого игрока обнуляем счетчик убийств и суммируем убийства всех типов враждебных мобов
      this.sendCommandFn('execute as @a run scoreboard players set @s KILL 0');
      hostileMobs.forEach(mob => {
        this.sendCommandFn(`execute as @a run scoreboard players operation @s KILL += @s kill_${mob}`);
      });
      
      // Отображаем индивидуальную статистику каждого игрока в scoreboard
      // Каждый игрок видит свою статистику в scoreboard KILL и DEAD
      // Статистика уже обновлена для каждого игрока отдельно
      // Не нужно суммировать - scoreboard автоматически показывает статистику каждого игрока
      
      // Удаляем старые строки времени, если они существуют
      this.sendCommandFn('scoreboard players reset GameTime gametime_display');
      this.sendCommandFn('scoreboard players reset Time gametime_display');
      this.sendCommandFn('scoreboard players reset Hour gametime_display');
      this.sendCommandFn('scoreboard players reset Min gametime_display');
      this.sendCommandFn('scoreboard players reset AMPM gametime_display');
      
      // Проверяем и выдаем награды за убийства
      this.checkAndRewardKills();
      
    } catch (error) {
      // Игнорируем ошибки, чтобы не спамить логи
      // console.error('Error updating stats display:', error);
    }
  }

  /**
   * Проверяет количество убийств игроков и выдает награды
   */
  checkAndRewardKills() {
    if (!this.sendCommandFn) {
      return;
    }

    try {
      // Для каждого игрока проверяем количество убийств и выдаем награды
      // Каждые 10 убийств = 1 железный слиток
      // Каждые 50 убийств = 10 железных слитков
      // Каждые 100 убийств = 1 алмазный блок
      
      // Создаем scoreboard для отслеживания последнего выданного количества убийств
      try {
        this.sendCommandFn('scoreboard objectives add last_rewarded_kills dummy');
      } catch (e) {
        // Scoreboard уже существует
      }
      
      // Для каждого игрока проверяем награды
      // Награды выдаются при каждом достижении порога, кратного 10 (10, 20, 30, 40, 50, 60, 70, 80, 90, 100...)
      // При 50 и 100 выдаются специальные награды
      
      // Используем модуль для проверки кратности 10
      this.sendCommandFn('execute as @a store result score #kills_mod10 gametime_display run scoreboard players get @s KILL');
      this.sendCommandFn('scoreboard players operation #kills_mod10 gametime_display %= #const_10 gametime_display');
      
      // Проверяем каждые 100 убийств (алмазный блок) - приоритет выше
      // Выдаем только если достигли 100 и последняя награда была меньше 100
      this.sendCommandFn('execute as @a if score @s KILL matches 100.. if score #kills_mod10 gametime_display matches 0 if score @s last_rewarded_kills matches ..99 run give @s minecraft:diamond_block 1');
      this.sendCommandFn('execute as @a if score @s KILL matches 100.. if score #kills_mod10 gametime_display matches 0 if score @s last_rewarded_kills matches ..99 run scoreboard players set @s last_rewarded_kills 100');
      
      // Проверяем каждые 50 убийств (10 железных слитков) - только если не достигли 100
      this.sendCommandFn('execute as @a if score @s KILL matches 50..99 if score #kills_mod10 gametime_display matches 0 if score @s last_rewarded_kills matches ..49 run give @s minecraft:iron_ingot 10');
      this.sendCommandFn('execute as @a if score @s KILL matches 50..99 if score #kills_mod10 gametime_display matches 0 if score @s last_rewarded_kills matches ..49 run scoreboard players set @s last_rewarded_kills 50');
      
      // Проверяем каждые 10 убийств (1 железный слиток) - только если не 50 и не 100
      // Для 10, 20, 30, 40
      this.sendCommandFn('execute as @a if score @s KILL matches 10..49 if score #kills_mod10 gametime_display matches 0 if score @s last_rewarded_kills < @s KILL run give @s minecraft:iron_ingot 1');
      this.sendCommandFn('execute as @a if score @s KILL matches 10..49 if score #kills_mod10 gametime_display matches 0 if score @s last_rewarded_kills < @s KILL run scoreboard players operation @s last_rewarded_kills = @s KILL');
      // Для 60, 70, 80, 90
      this.sendCommandFn('execute as @a if score @s KILL matches 60..99 if score #kills_mod10 gametime_display matches 0 if score @s last_rewarded_kills matches 50..59 run give @s minecraft:iron_ingot 1');
      this.sendCommandFn('execute as @a if score @s KILL matches 60..99 if score #kills_mod10 gametime_display matches 0 if score @s last_rewarded_kills matches 50..59 run scoreboard players operation @s last_rewarded_kills = @s KILL');
      // Для 110, 120, 130...
      this.sendCommandFn('execute as @a if score @s KILL matches 110.. if score #kills_mod10 gametime_display matches 0 if score @s last_rewarded_kills matches 100..109 run give @s minecraft:iron_ingot 1');
      this.sendCommandFn('execute as @a if score @s KILL matches 110.. if score #kills_mod10 gametime_display matches 0 if score @s last_rewarded_kills matches 100..109 run scoreboard players operation @s last_rewarded_kills = @s KILL');
      
    } catch (error) {
      // Игнорируем ошибки
      // console.error('Error checking rewards:', error);
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

