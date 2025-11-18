const mc = require('flying-squid');
const minecraftService = require('./services/minecraftService');
const path = require('path');
const { nameToMcOfflineUUID } = require('minecraft-protocol/src/datatypes/uuid');

const MINECRAFT_PORT = parseInt(process.env.MINECRAFT_PORT || '27015');
// ВАЖНО: flying-squid 1.11.0 поддерживает версии до ~1.16.4
// Для версий 1.17+ нужна более новая библиотека или форк
const SERVER_VERSION = process.env.MINECRAFT_VERSION || '1.16.4';
const SERVER_MOTD = process.env.MINECRAFT_MOTD || 'Minecraft Server';
const MAX_PLAYERS = parseInt(process.env.MINECRAFT_MAX_PLAYERS || '20');
const ONLINE_MODE = process.env.MINECRAFT_ONLINE_MODE === 'true';

let server = null;

/**
 * Создает и запускает Minecraft сервер
 */
async function startMinecraftServer() {
  if (server) {
    console.log('⚠️  Minecraft server is already running');
    return;
  }

  try {
    console.log(`🎮 Starting Minecraft server on port ${MINECRAFT_PORT}...`);
    console.log(`📋 Version: ${SERVER_VERSION}`);
    console.log(`👥 Max players: ${MAX_PLAYERS}`);
    console.log(`🔐 Online mode: ${ONLINE_MODE ? 'ENABLED (license check)' : 'DISABLED (cracked allowed)'}`);

    // Проверяем, не занят ли порт (простая проверка)
    const net = require('net');
    const testServer = net.createServer();
    
    try {
      await new Promise((resolve, reject) => {
        testServer.once('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            console.error(`❌ Port ${MINECRAFT_PORT} is already in use!`);
            console.error(`💡 Try stopping the existing server: pm2 stop minecraft-server`);
            console.error(`💡 Or check what's using the port: lsof -i :${MINECRAFT_PORT} or netstat -tulpn | grep ${MINECRAFT_PORT}`);
            reject(new Error(`Port ${MINECRAFT_PORT} is already in use`));
          } else {
            reject(err);
          }
        });
        
        testServer.listen(MINECRAFT_PORT, () => {
          testServer.close(() => resolve());
        });
      });
    } catch (err) {
      throw err;
    }

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
      // Генерация мира - не указываем, чтобы использовать генерацию по умолчанию
      // Если мир пустой, удалите папку minecraft-world и перезапустите сервер
      'kickTimeout': 10000,
      'plugins': {},
      'modpe': false,
      'view-distance': 10,
      'player-list-text': {
        'header': { 'text': 'Добро пожаловать!' },
        'footer': { 'text': 'Minecraft Server' }
      },
      'everybody-op': false,
      'max-entities': 100,
      // Увеличиваем время генерации мира
      'chunk-load-distance': 10, // Расстояние загрузки чанков
      'chunk-unload-distance': 12 // Расстояние выгрузки чанков
    });

    // Обработка подключения игрока
    server.on('login', (client) => {
      const username = client.username;
      // В flying-squid UUID может быть в разных форматах
      let uuid = client.uuid;
      if (!uuid && client.profile) {
        uuid = client.profile.id || client.profile.uuid;
      }
      if (!uuid) {
        // Генерируем правильный UUID для офлайн-игроков используя стандартную функцию Minecraft
        // Это гарантирует правильный формат и совместимость с протоколом
        uuid = nameToMcOfflineUUID(username);
      }
      
      // ВАЖНО: Устанавливаем UUID в объект клиента, чтобы flying-squid мог его использовать
      client.uuid = uuid;
      if (client.profile) {
        client.profile.id = uuid;
        client.profile.uuid = uuid;
      }
      
      // Также устанавливаем UUID в session, если он существует
      if (client.session) {
        if (client.session.selectedProfile) {
          client.session.selectedProfile.id = uuid;
        }
        client.session.uuid = uuid;
      }
      
      console.log(`✅ Player connected: ${username} (${uuid})`);
      console.log(`🌍 Generating world around player...`);
      
      // Сохраняем игрока в сервисе
      minecraftService.players.set(uuid, {
        username,
        uuid,
        connectedAt: new Date(),
        client
      });
      
      // После того как игрок заспавнится, убедимся что UUID установлен на player entity
      // Используем setTimeout чтобы дать flying-squid время создать player entity
      setTimeout(() => {
        try {
          // Пытаемся найти player entity через server.players или server._players
          if (server.players) {
            const playerEntity = server.players[username] || server.players[uuid];
            if (playerEntity) {
              playerEntity.uuid = uuid;
              if (playerEntity.profile) {
                playerEntity.profile.id = uuid;
                playerEntity.profile.uuid = uuid;
              }
              console.log(`🔧 Set UUID on player entity: ${username} -> ${uuid}`);
            }
          }
          // Также проверяем _players (приватное свойство)
          if (server._players) {
            const playerEntity = server._players[username] || server._players[uuid];
            if (playerEntity) {
              playerEntity.uuid = uuid;
              if (playerEntity.profile) {
                playerEntity.profile.id = uuid;
                playerEntity.profile.uuid = uuid;
              }
            }
          }
        } catch (err) {
          // Игнорируем ошибки доступа к внутренним свойствам
          console.warn(`⚠️  Could not set UUID on player entity: ${err.message}`);
        }
      }, 1000);

      // Логируем генерацию чанков вокруг игрока (5 сообщений)
      let chunksGenerated = 0;
      const chunkGenerationInterval = setInterval(() => {
        chunksGenerated++;
        if (chunksGenerated <= 5) {
          console.log(`🗺️  [${username}] Generating chunks... (${chunksGenerated}/5)`);
        }
        if (chunksGenerated >= 5) {
          clearInterval(chunkGenerationInterval);
          console.log(`✅ [${username}] Initial world generation completed`);
        }
      }, 2000);

      // Приветственное сообщение (с задержкой, чтобы игрок успел заспавниться)
      setTimeout(() => {
        try {
          if (client && client.write) {
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
      }, 5000); // Увеличена задержка до 5 секунд для генерации мира

      // Уведомляем других игроков (тоже с задержкой)
      setTimeout(() => {
        broadcastMessage(`Игрок ${username} присоединился к серверу`, username);
      }, 5000);
    });

    // Обработка отключения игрока
    server.on('playerQuit', (player) => {
      const username = player.username;
      let uuid = player.uuid;
      if (!uuid && player.profile) {
        uuid = player.profile.id || player.profile.uuid;
      }
      if (!uuid) {
        // Ищем по username если UUID нет
        const found = Array.from(minecraftService.players.values())
          .find(p => p.username === username);
        if (found) {
          uuid = found.uuid;
        }
      }
      
      if (uuid) {
        console.log(`❌ Player disconnected: ${username} (${uuid})`);
        minecraftService.players.delete(uuid);
      } else {
        console.log(`❌ Player disconnected: ${username} (UUID not found)`);
        // Удаляем по username если UUID не найден
        const toDelete = Array.from(minecraftService.players.entries())
          .find(([id, p]) => p.username === username);
        if (toDelete) {
          minecraftService.players.delete(toDelete[0]);
        }
      }

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

    // Обработка ошибок клиента (предотвращаем отключение из-за ошибок UUID)
    server.on('clientError', (client, err) => {
      // Игнорируем ошибки UUID при отправке информации об игроках
      if (err && err.message && (err.message.includes('UUID') || err.message.includes('undefined'))) {
        console.warn(`⚠️  UUID/undefined error for client (ignored, player stays connected):`, err.message.substring(0, 100));
        
        // Пытаемся исправить UUID клиента, если он undefined
        if (client) {
          const player = Array.from(minecraftService.players.values())
            .find(p => p.client === client || p.username === client.username);
          
          if (player && player.uuid) {
            // Устанавливаем UUID везде где возможно
            client.uuid = player.uuid;
            if (client.profile) {
              client.profile.id = player.uuid;
              client.profile.uuid = player.uuid;
            }
            if (client.session) {
              if (client.session.selectedProfile) {
                client.session.selectedProfile.id = player.uuid;
              }
              client.session.uuid = player.uuid;
            }
            
            // Также пытаемся найти и исправить player entity
            try {
              if (server.players) {
                const playerEntity = server.players[player.username] || server.players[player.uuid];
                if (playerEntity) {
                  playerEntity.uuid = player.uuid;
                  if (playerEntity.profile) {
                    playerEntity.profile.id = player.uuid;
                    playerEntity.profile.uuid = player.uuid;
                  }
                }
              }
              if (server._players) {
                const playerEntity = server._players[player.username] || server._players[player.uuid];
                if (playerEntity) {
                  playerEntity.uuid = player.uuid;
                  if (playerEntity.profile) {
                    playerEntity.profile.id = player.uuid;
                    playerEntity.profile.uuid = player.uuid;
                  }
                }
              }
            } catch (e) {
              // Игнорируем ошибки доступа
            }
            
            console.log(`🔧 Fixed UUID for client: ${player.username} -> ${player.uuid}`);
          } else if (client.username) {
            // Если игрок не найден в нашем сервисе, генерируем UUID используя стандартную функцию
            const newUuid = nameToMcOfflineUUID(client.username);
            client.uuid = newUuid;
            if (client.profile) {
              client.profile.id = newUuid;
              client.profile.uuid = newUuid;
            }
            if (client.session) {
              if (client.session.selectedProfile) {
                client.session.selectedProfile.id = newUuid;
              }
              client.session.uuid = newUuid;
            }
            console.log(`🔧 Generated new UUID for client: ${client.username} -> ${newUuid}`);
          }
        }
        
        return; // Не отключаем клиента
      }
      console.error(`❌ Client error:`, err);
    });

    // Обработка ошибок сервера (перехватываем ошибки UUID на уровне протокола)
    server.on('error', (err) => {
      if (err && err.message && (err.message.includes('UUID') || err.message.includes('undefined'))) {
        console.warn(`⚠️  Protocol UUID error (ignored):`, err.message.substring(0, 100));
        return; // Не обрабатываем как критическую ошибку
      }
      console.error('❌ Minecraft server error:', err);
    });

    // Сервер запущен
    server.on('listening', () => {
      console.log(`✅ Minecraft server is now listening on port ${MINECRAFT_PORT}`);
      console.log(`🌐 Players can connect to: localhost:${MINECRAFT_PORT}`);
      console.log(`🌍 World generation started...`);
      console.log(`⏳ Please wait for world generation to complete before connecting`);
      minecraftService.isRunning = true;
      minecraftService.server = server;
    });

    // Логирование событий генерации мира
    if (server.on) {
      // Слушаем события генерации чанков
      server.on('chunkColumnLoad', (chunk) => {
        console.log(`🗺️  Chunk loaded at X:${chunk.x}, Z:${chunk.z}`);
      });

      server.on('chunkColumnUnload', (chunk) => {
        console.log(`🗺️  Chunk unloaded at X:${chunk.x}, Z:${chunk.z}`);
      });
    }

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
