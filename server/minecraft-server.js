const minecraftProtocol = require('minecraft-protocol');
const minecraftService = require('./services/minecraftService');

const MINECRAFT_PORT = process.env.MINECRAFT_PORT || 27015;
// Для minecraft-protocol 1.26.5 поддерживаются версии до 1.12.2
// Можно также не указывать версию, тогда будет использована версия по умолчанию
const SERVER_VERSION = process.env.MINECRAFT_VERSION || '1.12.2';
const SERVER_MOTD = process.env.MINECRAFT_MOTD || 'Minecraft Server';
const MAX_PLAYERS = parseInt(process.env.MINECRAFT_MAX_PLAYERS || '20');

let server = null;

/**
 * Создает и запускает Minecraft сервер
 */
function startMinecraftServer() {
  if (server) {
    console.log('⚠️  Minecraft server is already running');
    return;
  }

  try {
    const onlineMode = process.env.MINECRAFT_ONLINE_MODE === 'true';
    console.log(`🎮 Starting Minecraft server on port ${MINECRAFT_PORT}...`);
    console.log(`📋 Version: ${SERVER_VERSION}`);
    console.log(`👥 Max players: ${MAX_PLAYERS}`);
    console.log(`🔐 Online mode: ${onlineMode ? 'ENABLED (license check)' : 'DISABLED (cracked allowed)'}`);

    // Создаем сервер с базовыми настройками
    // Для minecraft-protocol 1.26.5 поддерживаются версии до 1.12.2
    // Если нужна более новая версия, можно попробовать без указания версии
    // online-mode: false - позволяет подключаться нелицензионным версиям (по умолчанию)
    // online-mode: true - проверяет лицензию через Mojang API
    const serverOptions = {
      'online-mode': process.env.MINECRAFT_ONLINE_MODE === 'true', // По умолчанию false (офлайн режим)
      motd: SERVER_MOTD,
      'max-players': MAX_PLAYERS,
      port: MINECRAFT_PORT,
      keepAlive: true,
      keepAliveInitialDelay: 10000,
    };

    // Добавляем версию только если она указана
    // Если версия не поддерживается, можно убрать этот параметр
    if (SERVER_VERSION && SERVER_VERSION !== 'auto' && SERVER_VERSION !== 'none') {
      serverOptions.version = SERVER_VERSION;
    }

    server = minecraftProtocol.createServer(serverOptions);

    // Обработка подключения игрока
    server.on('login', (client) => {
      const username = client.username || client.profile?.name || 'Unknown';
      const uuid = client.uuid || client.profile?.id || 'unknown';
      
      console.log(`✅ Player connected: ${username} (${uuid})`);
      
      // Сохраняем игрока в сервисе
      minecraftService.players.set(uuid, {
        username,
        uuid,
        connectedAt: new Date(),
        client
      });

      // Инициализация игрока после логина
      // После события 'login' нужно отправить необходимые пакеты для входа в игру
      
      // Обрабатываем переход в игровое состояние
      client.once('spawn', () => {
        console.log(`🎮 Player ${username} spawned in game`);
      });

      // Отправляем начальные данные игроку после небольшой задержки
      // Это позволяет клиенту полностью инициализироваться
      setTimeout(() => {
        try {
          // Устанавливаем игровой режим (0 = выживание, 1 = творческий)
          client.write('game_state_change', {
            reason: 3, // Change game mode
            gameMode: 0 // Survival mode
          });

          // Отправляем начальную позицию (спавн)
          client.write('position', {
            x: 0,
            y: 64,
            z: 0,
            yaw: 0,
            pitch: 0,
            flags: 0x00
          });

          // Приветственное сообщение
          setTimeout(() => {
            try {
              client.write('chat', {
                message: JSON.stringify({
                  text: `Добро пожаловать на сервер, ${username}!`,
                  color: 'green'
                })
              });
            } catch (err) {
              console.error('Error sending welcome message:', err);
            }
          }, 500);
        } catch (err) {
          console.error(`Error initializing player ${username}:`, err);
        }
      }, 200);

      // Уведомляем других игроков
      broadcastMessage(`Игрок ${username} присоединился к серверу`, username);

      // Обработка всех пакетов от клиента для отладки
      client.on('packet', (data, meta) => {
        if (meta.name && !['keep_alive', 'position', 'position_look', 'look'].includes(meta.name)) {
          console.log(`📦 [${username}] Received packet: ${meta.name}`, data);
        }
      });

      // Обработка ошибок клиента
      client.on('error', (err) => {
        console.error(`❌ Error with client ${username}:`, err);
      });

      // Обработка отключения клиента
      client.on('end', () => {
        const player = Array.from(minecraftService.players.values())
          .find(p => p.client === client);
        
        if (player) {
          const { username, uuid } = player;
          console.log(`❌ Player disconnected: ${username}`);
          
          minecraftService.players.delete(uuid);

          // Уведомляем других игроков
          broadcastMessage(`Игрок ${username} покинул сервер`, username);
        }
      });
    });

    // Обработка отключения игрока (старый способ, оставляем для совместимости)
    server.on('end', (client, reason) => {
      const player = Array.from(minecraftService.players.values())
        .find(p => p.client === client);
      
      if (player) {
        const { username, uuid } = player;
        console.log(`❌ Player disconnected: ${username} (${reason || 'unknown reason'})`);
        
        minecraftService.players.delete(uuid);

        // Уведомляем других игроков
        broadcastMessage(`Игрок ${username} покинул сервер`, username);
      }
    });

    // Обработка ошибок
    server.on('error', (err) => {
      console.error('❌ Minecraft server error:', err);
    });

    // Обработка чата и команд
    server.on('chat', (client, packet) => {
      const player = Array.from(minecraftService.players.values())
        .find(p => p.client === client);
      
      if (player && packet.message) {
        const message = packet.message.trim();
        const username = player.username;
        
        // Проверяем, является ли сообщение командой
        if (message.startsWith('/')) {
          handleCommand(client, player, message);
        } else {
          // Обычное сообщение в чат
          console.log(`💬 [${username}]: ${message}`);

          // Отправляем сообщение всем игрокам
          broadcastMessage(`<${username}> ${message}`, username);
        }
      }
    });

    server.on('listening', () => {
      console.log(`✅ Minecraft server is now listening on port ${MINECRAFT_PORT}`);
      console.log(`🌐 Players can connect to: localhost:${MINECRAFT_PORT}`);
      minecraftService.isRunning = true;
      minecraftService.server = server;
    });

  } catch (err) {
    console.error('❌ Failed to start Minecraft server:', err);
    minecraftService.isRunning = false;
    throw err;
  }
}

/**
 * Останавливает Minecraft сервер
 */
function stopMinecraftServer() {
  if (!server) {
    console.log('⚠️  Minecraft server is not running');
    return;
  }

  try {
    console.log('🛑 Stopping Minecraft server...');
    
    // Отключаем всех игроков
    minecraftService.players.forEach((player, uuid) => {
      try {
        player.client.end('Server is shutting down');
      } catch (err) {
        console.error(`Error disconnecting player ${player.username}:`, err);
      }
    });

    minecraftService.players.clear();
    
    // Закрываем сервер
    server.close(() => {
      console.log('✅ Minecraft server stopped');
      minecraftService.isRunning = false;
      minecraftService.server = null;
      server = null;
    });
  } catch (err) {
    console.error('❌ Error stopping Minecraft server:', err);
    throw err;
  }
}

/**
 * Отправляет сообщение всем игрокам
 */
function broadcastMessage(message, excludeUsername = null) {
  minecraftService.players.forEach((player) => {
    if (excludeUsername && player.username === excludeUsername) {
      return; // Пропускаем отправителя
    }
    
    try {
      player.client.write('chat', {
        message: JSON.stringify({
          text: message,
          color: 'yellow'
        })
      });
    } catch (err) {
      console.error(`Error sending message to ${player.username}:`, err);
    }
  });
}

/**
 * Обрабатывает команды от игроков
 */
function handleCommand(client, player, command) {
  const [cmd, ...args] = command.slice(1).split(' ');
  const username = player.username;

  switch (cmd.toLowerCase()) {
    case 'help':
      client.write('chat', {
        message: JSON.stringify({
          text: 'Доступные команды: /help, /list, /time',
          color: 'aqua'
        })
      });
      break;

    case 'list':
      const playerList = Array.from(minecraftService.players.values())
        .map(p => p.username)
        .join(', ');
      client.write('chat', {
        message: JSON.stringify({
          text: `Игроков онлайн: ${minecraftService.players.size} - ${playerList || 'нет'}`,
          color: 'green'
        })
      });
      break;

    case 'time':
      const time = new Date().toLocaleString('ru-RU');
      client.write('chat', {
        message: JSON.stringify({
          text: `Текущее время: ${time}`,
          color: 'gold'
        })
      });
      break;

    default:
      client.write('chat', {
        message: JSON.stringify({
          text: `Неизвестная команда: /${cmd}. Используйте /help для списка команд.`,
          color: 'red'
        })
      });
  }
}

// Обработка завершения процесса
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  stopMinecraftServer();
  setTimeout(() => process.exit(0), 1000);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  stopMinecraftServer();
  setTimeout(() => process.exit(0), 1000);
});

module.exports = {
  startMinecraftServer,
  stopMinecraftServer,
  getServer: () => server
};

