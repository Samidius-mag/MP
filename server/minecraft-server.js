const mc = require('flying-squid');
const minecraftService = require('./services/minecraftService');
const path = require('path');

const MINECRAFT_PORT = parseInt(process.env.MINECRAFT_PORT || '27015');
const SERVER_VERSION = process.env.MINECRAFT_VERSION || '1.21.10';
const SERVER_MOTD = process.env.MINECRAFT_MOTD || 'Minecraft Server';
const MAX_PLAYERS = parseInt(process.env.MINECRAFT_MAX_PLAYERS || '20');
const ONLINE_MODE = process.env.MINECRAFT_ONLINE_MODE === 'true';

let server = null;

/**
 * Создает и запускает Minecrafte сервер
 */
function startMinecraftServer() {
  if (server) {
    console.log('⚠️  Minecraft server is already running');
    return;
  }

  try {
    console.log(`🎮 Starting Minecraft server on port ${MINECRAFT_PORT}...`);
    console.log(`📋 Version: ${SERVER_VERSION}`);
    console.log(`👥 Max players: ${MAX_PLAYERS}`);
    console.log(`🔐 Online mode: ${ONLINE_MODE ? 'ENABLED (license check)' : 'DISABLED (cracked allowed)'}`);

    // Создаем путь для мира сервера
    const worldPath = path.join(__dirname, '..', 'minecraft-world');

    // Создаем сервер с помощью flying-squid
    // Важно: нужно указать версию явно
    server = mc.createMCServer({
      'version': SERVER_VERSION, // Явно указываем версию
      'motd': SERVER_MOTD,
      'port': MINECRAFT_PORT,
      'max-players': MAX_PLAYERS,
      'online-mode': ONLINE_MODE,
      'logging': true,
      'gameMode': 0, // 0 = выживание, 1 = творческий
      'difficulty': 1, // 0 = мирный, 1 = легкий, 2 = нормальный, 3 = сложный
      'worldFolder': worldPath,
      'generation': {
        'name': 'superflat',
        'options': {
          'layers': [
            {
              'block': 'minecraft:bedrock',
              'height': 1
            },
            {
              'block': 'minecraft:dirt',
              'height': 2
            },
            {
              'block': 'minecraft:grass_block',
              'height': 1
            }
          ]
        }
      },
      'kickTimeout': 10000,
      'plugins': {},
      'modpe': false,
      'view-distance': 10,
      'player-list-text': {
        'header': { 'text': 'Добро пожаловать!' },
        'footer': { 'text': 'Minecraft Server' }
      },
      'everybody-op': false,
      'max-entities': 100
    });

    // Обработка подключения игрока
    server.on('login', (client) => {
      const username = client.username;
      const uuid = client.uuid || client.profile?.id || 'unknown';
      
      console.log(`✅ Player connected: ${username} (${uuid})`);
      
      // Сохраняем игрока в сервисе
      minecraftService.players.set(uuid, {
        username,
        uuid,
        connectedAt: new Date(),
        client
      });

      // Приветственное сообщение
      setTimeout(() => {
        try {
          if (client.write) {
            client.write('chat', {
              message: JSON.stringify({
                text: `Добро пожаловать на сервер, ${username}!`,
                color: 'green'
              })
            });
          }
        } catch (err) {
          console.error('Error sending welcome message:', err);
        }
      }, 1000);

      // Уведомляем других игроков
      broadcastMessage(`Игрок ${username} присоединился к серверу`, username);
    });

    // Обработка отключения игрока
    server.on('playerQuit', (player) => {
      const username = player.username;
      const uuid = player.uuid || 'unknown';
      
      console.log(`❌ Player disconnected: ${username}`);
      
      minecraftService.players.delete(uuid);

      // Уведомляем других игроков
      broadcastMessage(`Игрок ${username} покинул сервер`, username);
    });

    // Обработка сообщений в чате
    server.on('chat', (player, message) => {
      const username = player.username;
      const msg = message.toString().trim();
      
      console.log(`💬 [${username}]: ${msg}`);
      
      // Проверяем, является ли сообщение командой
      if (msg.startsWith('/')) {
        handleCommand(player, msg);
      } else {
        // Отправляем сообщение всем игрокам
        broadcastMessage(`<${username}> ${msg}`, username);
      }
    });

    // Обработка ошибок
    server.on('error', (err) => {
      console.error('❌ Minecraft server error:', err);
    });

    // Сервер запущен
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
        if (player.client && player.client.end) {
          player.client.end('Server is shutting down');
        }
      } catch (err) {
        console.error(`Error disconnecting player ${player.username}:`, err);
      }
    });

    minecraftService.players.clear();
    
    // Закрываем сервер
    if (server.close) {
      server.close(() => {
        console.log('✅ Minecraft server stopped');
        minecraftService.isRunning = false;
        minecraftService.server = null;
        server = null;
      });
    } else {
      minecraftService.isRunning = false;
      minecraftService.server = null;
      server = null;
      console.log('✅ Minecraft server stopped');
    }
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
      if (player.client && player.client.write) {
        player.client.write('chat', {
          message: JSON.stringify({
            text: message,
            color: 'yellow'
          })
        });
      }
    } catch (err) {
      console.error(`Error sending message to ${player.username}:`, err);
    }
  });
}

/**
 * Обрабатывает команды от игроков
 */
function handleCommand(player, command) {
  const [cmd, ...args] = command.slice(1).split(' ');
  const username = player.username;

  switch (cmd.toLowerCase()) {
    case 'help':
      if (player.chat) {
        player.chat('Доступные команды: /help, /list, /time');
      }
      break;

    case 'list':
      const playerList = Array.from(minecraftService.players.values())
        .map(p => p.username)
        .join(', ');
      if (player.chat) {
        player.chat(`Игроков онлайн: ${minecraftService.players.size} - ${playerList || 'нет'}`);
      }
      break;

    case 'time':
      const time = new Date().toLocaleString('ru-RU');
      if (player.chat) {
        player.chat(`Текущее время: ${time}`);
      }
      break;

    default:
      if (player.chat) {
        player.chat(`Неизвестная команда: /${cmd}. Используйте /help для списка команд.`);
      }
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
