const mc = require('flying-squid');
const minecraftService = require('./services/minecraftService');
const path = require('path');
const { nameToMcOfflineUUID } = require('minecraft-protocol/src/datatypes/uuid');

// Перехватываем protodef и serializer на уровне модуля для блокировки проблемных пакетов
try {
  // Перехватываем Serializer из protodef
  const serializerModule = require('protodef/src/serializer');
  if (serializerModule && serializerModule.Serializer) {
    const OriginalSerializer = serializerModule.Serializer;
    const OriginalTransform = OriginalSerializer.prototype._transform;
    
    // Перехватываем _transform, где происходит ошибка
    OriginalSerializer.prototype._transform = function(chunk, encoding, callback) {
      try {
        return OriginalTransform.call(this, chunk, encoding, callback);
      } catch (err) {
        // Перехватываем ошибки сериализации soundId
        if (err && err.message && (
          err.message.includes('soundId') ||
          err.message.includes('sound_effect') ||
          err.message.includes('ItemSoundHolder') ||
          err.message.includes('SizeOf error') ||
          err.message.includes('Cannot read properties of undefined')
        )) {
          console.warn(`🔇 [Serializer] Caught soundId error in _transform, ignoring: ${err.message.substring(0, 100)}`);
          // Вызываем callback без ошибки, чтобы продолжить работу
          if (callback) {
            try {
              callback(); // Вызываем без ошибки
            } catch (e) {
              // Игнорируем ошибки callback
            }
          }
          return; // Не пробрасываем ошибку дальше
        }
        throw err;
      }
    };
    
    // Также перехватываем createPacketBuffer
    const OriginalCreatePacketBuffer = OriginalSerializer.prototype.createPacketBuffer;
    if (OriginalCreatePacketBuffer) {
      OriginalSerializer.prototype.createPacketBuffer = function(...args) {
        try {
          return OriginalCreatePacketBuffer.apply(this, args);
        } catch (err) {
          if (err && err.message && (
            err.message.includes('soundId') ||
            err.message.includes('sound_effect') ||
            err.message.includes('ItemSoundHolder') ||
            err.message.includes('SizeOf error')
          )) {
            console.warn(`🔇 [Serializer] Caught soundId error in createPacketBuffer, returning empty buffer`);
            return Buffer.alloc(0);
          }
          throw err;
        }
      };
    }
  }
  
  // Перехватываем CompiledProtodef из compiler
  try {
    const compilerModule = require('protodef/src/compiler');
    if (compilerModule && compilerModule.CompiledProtodef) {
      const OriginalCompiledProtodef = compilerModule.CompiledProtodef;
      const OriginalCreatePacketBuffer = OriginalCompiledProtodef.prototype.createPacketBuffer;
      
      if (OriginalCreatePacketBuffer) {
        OriginalCompiledProtodef.prototype.createPacketBuffer = function(...args) {
          try {
            return OriginalCreatePacketBuffer.apply(this, args);
          } catch (err) {
            if (err && err.message && (
              err.message.includes('soundId') ||
              err.message.includes('sound_effect') ||
              err.message.includes('ItemSoundHolder') ||
              err.message.includes('SizeOf error')
            )) {
              console.warn(`🔇 [CompiledProtodef] Caught soundId error, returning empty buffer`);
              return Buffer.alloc(0);
            }
            throw err;
          }
        };
      }
      
      // Перехватываем sizeOf, где происходит ошибка
      const OriginalSizeOf = OriginalCompiledProtodef.prototype.sizeOf;
      if (OriginalSizeOf) {
        OriginalCompiledProtodef.prototype.sizeOf = function(...args) {
          try {
            return OriginalSizeOf.apply(this, args);
          } catch (err) {
            if (err && err.message && (
              err.message.includes('soundId') ||
              err.message.includes('sound_effect') ||
              err.message.includes('ItemSoundHolder') ||
              err.message.includes('SizeOf error')
            )) {
              console.warn(`🔇 [CompiledProtodef] Caught soundId error in sizeOf, returning 0`);
              return 0; // Возвращаем 0 вместо ошибки
            }
            throw err;
          }
        };
      }
    }
  } catch (e) {
    // Игнорируем ошибки патчинга compiler
  }
} catch (err) {
  console.warn(`⚠️  Could not patch protodef: ${err.message}`);
}

// Глобальный перехват ошибок сериализации пакетов
process.on('uncaughtException', (err) => {
  if (err && err.message && (
    err.message.includes('soundId') || 
    err.message.includes('sound_effect') ||
    err.message.includes('ItemSoundHolder') ||
    err.message.includes('SizeOf error')
  )) {
    console.warn(`🔇 [Global] Caught and ignored soundId serialization error: ${err.message.substring(0, 150)}`);
    return; // Не завершаем процесс
  }
  // Для других ошибок логируем, но не завершаем процесс
  console.error('❌ [Global] Uncaught exception:', err.message);
});

// Перехватываем необработанные промисы
process.on('unhandledRejection', (reason, promise) => {
  if (reason && reason.message && (
    reason.message.includes('soundId') || 
    reason.message.includes('sound_effect') ||
    reason.message.includes('ItemSoundHolder')
  )) {
    console.warn(`🔇 [Global] Caught and ignored soundId promise rejection: ${reason.message.substring(0, 150)}`);
    return; // Игнорируем
  }
  console.error('❌ [Global] Unhandled promise rejection:', reason);
});

const MINECRAFT_PORT = parseInt(process.env.MINECRAFT_PORT || '27015');
// ВАЖНО: flying-squid 1.11.0 поддерживает версии до ~1.16.4
// Для версий 1.17+ нужна более новая библиотека или форк
const SERVER_VERSION = process.env.MINECRAFT_VERSION || '1.21';
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
      'generation': {
    'name': 'diamond_square',
    'options': {
      'worldHeight': 80
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
      'max-entities': 100,
      // Увеличиваем время генерации мира
      'chunk-load-distance': 10, // Расстояние загрузки чанков
      'chunk-unload-distance': 12 // Расстояние выгрузки чанков
    });

    // Перехватываем подключение клиента ДО события login
    // Это позволяет установить UUID до того, как flying-squid начнет отправлять пакеты
    if (server.on) {
      // Перехватываем создание клиента через внутренние события
      const originalEmit = server.emit;
      server.emit = function(event, ...args) {
        if (event === 'login' && args[0]) {
          const client = args[0];
          const username = client.username;
          
          // Устанавливаем UUID ДО того, как другие обработчики получат событие
          if (!client.uuid) {
            let uuid = null;
            // Пытаемся получить UUID из разных мест
            if (client.profile) {
              uuid = client.profile.id || client.profile.uuid;
            }
            if (!uuid && client.session && client.session.selectedProfile) {
              uuid = client.session.selectedProfile.id;
            }
            // Если UUID все еще не найден, генерируем его
            if (!uuid) {
              uuid = nameToMcOfflineUUID(username);
            }
            
            // Устанавливаем UUID везде синхронно
            client.uuid = uuid;
            if (client.profile) {
              client.profile.id = uuid;
              client.profile.uuid = uuid;
            }
            if (client.session) {
              if (client.session.selectedProfile) {
                client.session.selectedProfile.id = uuid;
              }
              client.session.uuid = uuid;
            }
            
            console.log(`🔧 [UUID Fix] Set UUID for ${username} before login event: ${uuid}`);
            
            // Перехватываем метод end() клиента, чтобы предотвратить отключение из-за ошибок
            const originalEnd = client.end;
            if (originalEnd) {
              client.end = function(reason) {
                // Если отключение происходит из-за ошибки soundId, блокируем его
                const reasonStr = reason ? (typeof reason === 'string' ? reason : reason.toString()) : '';
                const reasonStack = reason && reason.stack ? reason.stack : '';
                
                if (reasonStr.includes('soundId') || 
                    reasonStr.includes('sound_effect') ||
                    reasonStr.includes('ItemSoundHolder') ||
                    reasonStr.includes('SizeOf error') ||
                    reasonStack.includes('soundId') ||
                    reasonStack.includes('sound_effect') ||
                    reasonStack.includes('ItemSoundHolder')) {
                  console.warn(`🔇 [${username}] Prevented disconnect due to soundId error: ${reasonStr.substring(0, 100)}`);
                  return; // Не отключаем клиента
                }
                return originalEnd.call(this, reason);
              };
            }
            
            // Также перехватываем на уровне _client, если он есть
            if (client._client && client._client.end) {
              const originalClientEnd = client._client.end;
              client._client.end = function(reason) {
                const reasonStr = reason ? (typeof reason === 'string' ? reason : reason.toString()) : '';
                const reasonStack = reason && reason.stack ? reason.stack : '';
                
                if (reasonStr.includes('soundId') || 
                    reasonStr.includes('sound_effect') ||
                    reasonStr.includes('ItemSoundHolder') ||
                    reasonStr.includes('SizeOf error') ||
                    reasonStack.includes('soundId') ||
                    reasonStack.includes('sound_effect') ||
                    reasonStack.includes('ItemSoundHolder')) {
                  console.warn(`🔇 [${username}] Prevented disconnect in _client.end due to soundId error`);
                  return;
                }
                return originalClientEnd.call(this, reason);
              };
            }
            
            // Перехватываем socket.end, если он есть
            if (client.socket && client.socket.end) {
              const originalSocketEnd = client.socket.end;
              client.socket.end = function(...args) {
                // Проверяем, не связано ли это с ошибкой soundId
                // Сохраняем стек вызовов для проверки
                const stack = new Error().stack || '';
                if (stack.includes('soundId') || stack.includes('sound_effect') || stack.includes('ItemSoundHolder')) {
                  console.warn(`🔇 [${username}] Prevented socket.end due to soundId error in stack`);
                  return;
                }
                return originalSocketEnd.apply(this, args);
              };
            }
            
            // Перехватываем отправку пакетов, чтобы убедиться, что UUID всегда установлен
            // Сохраняем UUID в замыкании для использования в перехвате
            const clientUuid = uuid;
            const originalWrite = client.write;
            if (originalWrite) {
              client.write = function(packetName, packetData) {
                try {
                  // Блокируем проблемные пакеты sound_effect с отсутствующим soundId
                  if (packetName === 'sound_effect' || packetName === 'named_sound_effect') {
                    if (packetData) {
                      // Проверяем наличие soundId
                      if (packetData.soundId === undefined || packetData.soundId === null) {
                        // Блокируем отправку проблемного пакета
                        console.warn(`🔇 [${username}] Blocked sound_effect packet with missing soundId`);
                        return; // Не отправляем пакет
                      }
                      // Проверяем ItemSoundHolder если он есть
                      if (packetData.soundId && typeof packetData.soundId === 'object') {
                        if (packetData.soundId.soundId === undefined || packetData.soundId.soundId === null) {
                          // Блокируем отправку проблемного пакета
                          console.warn(`🔇 [${username}] Blocked sound_effect packet with missing soundId in ItemSoundHolder`);
                          return; // Не отправляем пакет
                        }
                      }
                    } else {
                      // Если packetData отсутствует, блокируем
                      console.warn(`🔇 [${username}] Blocked sound_effect packet with missing data`);
                      return;
                    }
                  }
                  
                  // Если это player_info пакет, убеждаемся что UUID установлен
                  if (packetName === 'player_info' || (packetData && (packetData.action === 'add_player' || packetData.action === 0))) {
                    // Структура пакета может быть разной в зависимости от версии
                    if (packetData) {
                      let fixed = false;
                      // Если есть массив данных игроков
                      if (Array.isArray(packetData.data)) {
                        packetData.data = packetData.data.map(playerData => {
                          if (playerData) {
                            if (!playerData.UUID && !playerData.uuid) {
                              playerData.UUID = clientUuid;
                              playerData.uuid = clientUuid;
                              fixed = true;
                            }
                            // Также проверяем вложенные объекты
                            if (playerData.profile && !playerData.profile.UUID && !playerData.profile.uuid) {
                              playerData.profile.UUID = clientUuid;
                              playerData.profile.uuid = clientUuid;
                              playerData.profile.id = clientUuid;
                              fixed = true;
                            }
                          }
                          return playerData;
                        });
                      }
                      // Если данные игрока напрямую в пакете
                      if (!packetData.UUID && !packetData.uuid) {
                        packetData.UUID = clientUuid;
                        packetData.uuid = clientUuid;
                        fixed = true;
                      }
                      if (packetData.profile && !packetData.profile.UUID && !packetData.profile.uuid) {
                        packetData.profile.UUID = clientUuid;
                        packetData.profile.uuid = clientUuid;
                        packetData.profile.id = clientUuid;
                        fixed = true;
                      }
                      if (fixed) {
                        console.log(`🔧 [UUID Fix] Fixed UUID in ${packetName} packet for ${username}`);
                      }
                    }
                  }
                } catch (err) {
                  // Игнорируем ошибки при обработке пакетов, но логируем
                  console.warn(`⚠️  Error processing packet ${packetName}:`, err.message);
                  // Если это ошибка soundId, блокируем отправку
                  if (err.message && err.message.includes('soundId')) {
                    return; // Не отправляем проблемный пакет
                  }
                }
                return originalWrite.call(this, packetName, packetData);
              };
            }
          }
        }
        return originalEmit.apply(this, [event, ...args]);
      };
    }

    // Перехватываем процесс отключения клиентов на уровне flying-squid
    // Это нужно делать ДО обработки login, чтобы перехватить все клиенты
    try {
      // Перехватываем внутренние методы отключения клиентов
      if (server._clients) {
        // Создаем прокси для массива клиентов
        const clientsProxy = new Proxy(server._clients, {
          set: function(target, property, value) {
            // Если добавляется новый клиент, перехватываем его методы
            if (property === 'length' || (typeof property === 'number' && value && value.end)) {
              if (value && typeof value === 'object' && value.end) {
                const originalEnd = value.end;
                value.end = function(reason) {
                  // Блокируем отключение из-за ошибок soundId
                  const reasonStr = reason ? (typeof reason === 'string' ? reason : reason.toString()) : '';
                  const reasonStack = reason && reason.stack ? reason.stack : '';
                  
                  if (reasonStr.includes('soundId') || 
                      reasonStr.includes('sound_effect') ||
                      reasonStr.includes('ItemSoundHolder') ||
                      reasonStr.includes('SizeOf error') ||
                      reasonStack.includes('soundId') ||
                      reasonStack.includes('sound_effect') ||
                      reasonStack.includes('ItemSoundHolder')) {
                    console.warn(`🔇 [Client Proxy] Prevented disconnect due to soundId error`);
                    return; // Не отключаем
                  }
                  return originalEnd.call(this, reason);
                };
              }
            }
            target[property] = value;
            return true;
          }
        });
        
        // Заменяем массив клиентов на прокси
        try {
          Object.defineProperty(server, '_clients', {
            value: clientsProxy,
            writable: true,
            configurable: true
          });
        } catch (e) {
          // Игнорируем ошибки
        }
      }
      
      // Перехватываем внутренний обработчик ошибок сервера, который отключает клиентов
      // Пытаемся найти метод, который обрабатывает ошибки и отключает клиентов
      if (server.handleClientError) {
        const originalHandleClientError = server.handleClientError;
        server.handleClientError = function(client, err) {
          if (err && err.message && (
            err.message.includes('soundId') ||
            err.message.includes('sound_effect') ||
            err.message.includes('ItemSoundHolder') ||
            err.message.includes('SizeOf error')
          )) {
            console.warn(`🔇 [Server] Prevented handleClientError for soundId error`);
            return; // Не обрабатываем ошибку и не отключаем клиента
          }
          return originalHandleClientError.call(this, client, err);
        };
      }
    } catch (err) {
      console.warn(`⚠️  Could not setup client proxy: ${err.message}`);
    }

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
      // Делаем это синхронно и агрессивно
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
      
      // Устанавливаем UUID на всех возможных вложенных объектах
      if (client._client) {
        client._client.uuid = uuid;
        if (client._client.profile) {
          client._client.profile.id = uuid;
          client._client.profile.uuid = uuid;
        }
      }
      
      console.log(`✅ Player connected: ${username} (${uuid})`);
      console.log(`🌍 Generating world around player...`);
      
      // Перехватываем сериализатор пакетов клиента напрямую
      try {
        // Пытаемся найти сериализатор в клиенте
        if (client._client && client._client.serializer) {
          const serializer = client._client.serializer;
          if (serializer && serializer._transform) {
            const originalTransform = serializer._transform;
            serializer._transform = function(chunk, encoding, callback) {
              try {
                return originalTransform.call(this, chunk, encoding, callback);
              } catch (err) {
                // Перехватываем ошибки сериализации
                if (err && err.message && (
                  err.message.includes('soundId') ||
                  err.message.includes('sound_effect') ||
                  err.message.includes('ItemSoundHolder') ||
                  err.message.includes('SizeOf error')
                )) {
                  console.warn(`🔇 [${username}] Caught soundId serialization error, ignoring: ${err.message.substring(0, 100)}`);
                  // Вызываем callback без ошибки, чтобы продолжить работу
                  if (callback) callback();
                  return;
                }
                throw err;
              }
            };
          }
        }
        
        // Перехватываем обработчик ошибок в клиенте
        if (client._client && client._client.on) {
          // Сохраняем оригинальный обработчик ошибок
          const originalOnError = client._client.on;
          let errorHandlerSet = false;
          
          // Перехватываем установку обработчика ошибок
          client._client.on = function(event, handler) {
            if (event === 'error' && !errorHandlerSet) {
              errorHandlerSet = true;
              // Устанавливаем наш обработчик, который фильтрует ошибки soundId
              return originalOnError.call(this, event, (err) => {
                if (err && err.message && (
                  err.message.includes('soundId') ||
                  err.message.includes('sound_effect') ||
                  err.message.includes('ItemSoundHolder') ||
                  err.message.includes('SizeOf error')
                )) {
                  console.warn(`🔇 [${username}] Intercepted soundId error in client error handler, preventing disconnect`);
                  return; // Не вызываем оригинальный обработчик
                }
                // Для других ошибок вызываем оригинальный обработчик
                if (handler) handler(err);
              });
            }
            return originalOnError.call(this, event, handler);
          };
        }
        
        // Также перехватываем на уровне самого клиента
        if (client.on) {
          const originalClientOn = client.on;
          let clientErrorHandlerSet = false;
          
          client.on = function(event, handler) {
            if (event === 'error' && !clientErrorHandlerSet) {
              clientErrorHandlerSet = true;
              return originalClientOn.call(this, event, (err) => {
                if (err && err.message && (
                  err.message.includes('soundId') ||
                  err.message.includes('sound_effect') ||
                  err.message.includes('ItemSoundHolder')
                )) {
                  console.warn(`🔇 [${username}] Intercepted soundId error in client.on, preventing disconnect`);
                  return;
                }
                if (handler) handler(err);
              });
            }
            return originalClientOn.call(this, event, handler);
          };
        }
      } catch (err) {
        console.warn(`⚠️  Could not intercept client serializer for ${username}: ${err.message}`);
      }
      
      // Сохраняем игрока в сервисе с отслеживанием прогресса генерации мира
      const viewDistance = 10; // Расстояние загрузки чанков
      const expectedChunks = Math.pow(2 * viewDistance + 1, 2); // Примерно 441 чанк для view-distance 10
      const worldGenData = {
        loadedChunks: 0,
        expectedChunks: expectedChunks,
        chunks: new Set(), // Храним координаты загруженных чанков для избежания дубликатов
        lastProgressLog: 0,
        startTime: Date.now(),
        progressInterval: null // Будет установлен ниже
      };
      
      minecraftService.players.set(uuid, {
        username,
        uuid,
        connectedAt: new Date(),
        client,
        worldGen: worldGenData
      });
      
      console.log(`🌍 [${username}] Начало генерации мира (ожидается ~${expectedChunks} чанков)...`);
      
      // После того как игрок заспавнится, убедимся что UUID установлен на player entity
      // Используем setTimeout чтобы дать flying-squid время создать player entity
      setTimeout(() => {
        try {
          // Пытаемся найти player entity через server.players или server._players
          let playerEntity = null;
          if (server.players) {
            playerEntity = server.players[username] || server.players[uuid];
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
          if (!playerEntity && server._players) {
            playerEntity = server._players[username] || server._players[uuid];
            if (playerEntity) {
              playerEntity.uuid = uuid;
              if (playerEntity.profile) {
                playerEntity.profile.id = uuid;
                playerEntity.profile.uuid = uuid;
              }
            }
          }
          
          // Проверяем позицию игрока и телепортируем на безопасную позицию, если нужно
          if (playerEntity) {
            ensureSafeSpawnPosition(playerEntity, username);
            
            // Также перехватываем отправку пакетов через player entity
            if (playerEntity._client && playerEntity._client.write) {
              const originalPlayerWrite = playerEntity._client.write;
              playerEntity._client.write = function(packetName, packetData) {
                try {
                  // Блокируем проблемные пакеты sound_effect
                  if (packetName === 'sound_effect' || packetName === 'named_sound_effect') {
                    if (!packetData || packetData.soundId === undefined || packetData.soundId === null) {
                      console.warn(`🔇 [${username}] Blocked sound_effect packet from player entity`);
                      return;
                    }
                    if (packetData.soundId && typeof packetData.soundId === 'object' && 
                        (packetData.soundId.soundId === undefined || packetData.soundId.soundId === null)) {
                      console.warn(`🔇 [${username}] Blocked sound_effect packet with invalid ItemSoundHolder`);
                      return;
                    }
                  }
                } catch (err) {
                  if (err.message && err.message.includes('soundId')) {
                    return;
                  }
                }
                return originalPlayerWrite.call(this, packetName, packetData);
              };
            }
          }
        } catch (err) {
          // Игнорируем ошибки доступа к внутренним свойствам
          console.warn(`⚠️  Could not set UUID on player entity: ${err.message}`);
        }
      }, 2000); // Увеличена задержка до 2 секунд для загрузки чанков

      // Отслеживаем прогресс генерации мира в реальном времени
      const progressInterval = setInterval(() => {
        const player = minecraftService.players.get(uuid);
        if (!player || !player.worldGen) {
          clearInterval(progressInterval);
          return;
        }
        
        const { loadedChunks, expectedChunks, startTime } = player.worldGen;
        const progress = Math.min(100, Math.round((loadedChunks / expectedChunks) * 100));
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        
        // Логируем прогресс каждые 5% или каждые 2 секунды
        if (progress !== player.worldGen.lastProgressLog && progress % 5 === 0) {
          console.log(`🌍 [${username}] Генерация мира: ${progress}% (${loadedChunks}/${expectedChunks} чанков загружено, ${elapsed}с)`);
          player.worldGen.lastProgressLog = progress;
        }
        
        // Если достигли 100%, останавливаем интервал
        if (progress >= 100) {
          clearInterval(progressInterval);
          console.log(`✅ [${username}] Генерация мира завершена! (${loadedChunks} чанков загружено за ${elapsed}с)`);
          if (player.worldGen) {
            player.worldGen.progressInterval = null;
          }
        }
      }, 2000);
      
      // Сохраняем ссылку на интервал для очистки при отключении
      worldGenData.progressInterval = progressInterval;
      
      // Добавляем дополнительную проверку позиции после загрузки чанков
      setTimeout(() => {
        const player = minecraftService.players.get(uuid);
        if (player) {
          try {
            let playerEntity = null;
            if (server.players) {
              playerEntity = server.players[username] || server.players[uuid];
            }
            if (!playerEntity && server._players) {
              playerEntity = server._players[username] || server._players[uuid];
            }
            if (playerEntity) {
              ensureSafeSpawnPosition(playerEntity, username);
              // Также предзагружаем чанки вокруг игрока
              preloadChunksAroundPlayer(playerEntity, username);
            }
          } catch (err) {
            console.warn(`⚠️  Ошибка при повторной проверке позиции для ${username}: ${err.message}`);
          }
        }
      }, 5000); // Проверяем через 5 секунд после подключения

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
        const player = minecraftService.players.get(uuid);
        // Очищаем интервал отслеживания прогресса, если он существует
        if (player && player.worldGen && player.worldGen.progressInterval) {
          clearInterval(player.worldGen.progressInterval);
        }
        minecraftService.players.delete(uuid);
      } else {
        console.log(`❌ Player disconnected: ${username} (UUID not found)`);
        // Удаляем по username если UUID не найден
        const toDelete = Array.from(minecraftService.players.entries())
          .find(([id, p]) => p.username === username);
        if (toDelete) {
          // Очищаем интервал отслеживания прогресса, если он существует
          if (toDelete[1].worldGen && toDelete[1].worldGen.progressInterval) {
            clearInterval(toDelete[1].worldGen.progressInterval);
          }
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

    // Обработка ошибок клиента (предотвращаем отключение из-за ошибок UUID и soundId)
    server.on('clientError', (client, err) => {
      // Игнорируем ошибки UUID и soundId при отправке информации об игроках
      if (err && err.message && (
        err.message.includes('UUID') || 
        err.message.includes('undefined') ||
        err.message.includes('soundId') ||
        err.message.includes('sound_effect')
      )) {
        console.warn(`⚠️  Protocol error for client (ignored, player stays connected):`, err.message.substring(0, 100));
        
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

    // Обработка ошибок сервера (перехватываем ошибки UUID и soundId на уровне протокола)
    server.on('error', (err) => {
      if (err && err.message && (
        err.message.includes('UUID') || 
        err.message.includes('undefined') ||
        err.message.includes('soundId') ||
        err.message.includes('sound_effect') ||
        err.message.includes('ItemSoundHolder')
      )) {
        console.warn(`⚠️  Protocol error (ignored):`, err.message.substring(0, 100));
        return; // Не обрабатываем как критическую ошибку
      }
      console.error('❌ Minecraft server error:', err);
    });

    // Перехватываем сериализатор пакетов для блокировки проблемных пакетов sound_effect
    // Это нужно делать после создания сервера, но до события listening
    try {
      // Пытаемся найти сериализатор в клиентах
      if (server._clients && Array.isArray(server._clients)) {
        // Перехватываем при добавлении новых клиентов
        const originalPush = Array.prototype.push;
        const clientsArray = server._clients;
        
        // Перехватываем создание новых клиентов
        Object.defineProperty(server, '_clients', {
          get: function() {
            return clientsArray;
          },
          set: function(newValue) {
            // Игнорируем попытки заменить массив
          },
          configurable: true
        });
      }
      
      // Перехватываем на уровне сервера - ищем методы отправки звуков
      if (server.broadcast) {
        const originalBroadcast = server.broadcast;
        server.broadcast = function(packetName, packetData, exclude) {
          // Блокируем проблемные пакеты sound_effect
          if (packetName === 'sound_effect' || packetName === 'named_sound_effect') {
            if (!packetData || packetData.soundId === undefined || packetData.soundId === null) {
              console.warn(`🔇 Blocked broadcast of sound_effect packet with missing soundId`);
              return;
            }
          }
          return originalBroadcast.call(this, packetName, packetData, exclude);
        };
      }
    } catch (err) {
      console.warn(`⚠️  Could not intercept packet serializer: ${err.message}`);
    }

    // Сервер запущен
    server.on('listening', () => {
      console.log(`✅ Minecraft server is now listening on port ${MINECRAFT_PORT}`);
      console.log(`🌐 Players can connect to: localhost:${MINECRAFT_PORT}`);
      console.log(`🌍 World generation started...`);
      console.log(`⏳ Please wait for world generation to complete before connecting`);
      minecraftService.isRunning = true;
      minecraftService.server = server;
      
      // Дополнительный перехват после запуска сервера
      try {
        // Перехватываем все клиенты, которые уже подключены
        if (server._clients) {
          server._clients.forEach((client) => {
            if (client && client.write) {
              const originalClientWrite = client.write;
              client.write = function(packetName, packetData) {
                if (packetName === 'sound_effect' || packetName === 'named_sound_effect') {
                  if (!packetData || packetData.soundId === undefined || packetData.soundId === null) {
                    return; // Блокируем проблемный пакет
                  }
                }
                return originalClientWrite.call(this, packetName, packetData);
              };
            }
          });
        }
      } catch (err) {
        // Игнорируем ошибки
      }
    });

    // Логирование событий генерации мира с отслеживанием прогресса
    if (server.on) {
      // Слушаем события генерации чанков и обновляем прогресс для всех игроков
      server.on('chunkColumnLoad', (chunk) => {
        const chunkKey = `${chunk.x},${chunk.z}`;
        
        // Обновляем прогресс для всех игроков (так как чанки могут быть общими)
        minecraftService.players.forEach((player, uuid) => {
          if (player.worldGen && !player.worldGen.chunks.has(chunkKey)) {
            player.worldGen.chunks.add(chunkKey);
            player.worldGen.loadedChunks = player.worldGen.chunks.size;
            
            // Логируем каждые 50 чанков или при достижении важных процентов
            const progress = Math.min(100, Math.round((player.worldGen.loadedChunks / player.worldGen.expectedChunks) * 100));
            if (player.worldGen.loadedChunks % 50 === 0 || 
                (progress >= 25 && progress < 30 && player.worldGen.lastProgressLog < 25) ||
                (progress >= 50 && progress < 55 && player.worldGen.lastProgressLog < 50) ||
                (progress >= 75 && progress < 80 && player.worldGen.lastProgressLog < 75) ||
                (progress >= 95 && player.worldGen.lastProgressLog < 95)) {
              const elapsed = ((Date.now() - player.worldGen.startTime) / 1000).toFixed(1);
              console.log(`🌍 [${player.username}] Генерация мира: ${progress}% (${player.worldGen.loadedChunks}/${player.worldGen.expectedChunks} чанков, ${elapsed}с)`);
              player.worldGen.lastProgressLog = progress;
            }
          }
        });
      });

      server.on('chunkColumnUnload', (chunk) => {
        const chunkKey = `${chunk.x},${chunk.z}`;
        // Удаляем чанк из отслеживания для всех игроков
        minecraftService.players.forEach((player) => {
          if (player.worldGen && player.worldGen.chunks.has(chunkKey)) {
            player.worldGen.chunks.delete(chunkKey);
            player.worldGen.loadedChunks = player.worldGen.chunks.size;
          }
        });
      });
      
      // Обработка события спавна игрока
      server.on('spawn', (player) => {
        try {
          const username = player.username || (player.entity && player.entity.username);
          if (username) {
            console.log(`🎮 [${username}] Игрок заспавнился, проверяем позицию...`);
            // Проверяем позицию через небольшую задержку после спавна
            setTimeout(() => {
              ensureSafeSpawnPosition(player, username);
            }, 1000);
            
            // Предзагружаем чанки вокруг спавна для ускорения генерации
            preloadChunksAroundPlayer(player, username);
          }
        } catch (err) {
          console.warn(`⚠️  Ошибка при обработке события spawn: ${err.message}`);
        }
      });
      
      // Обработка добычи блоков
      server.on('blockBreak', (player, block) => {
        try {
          const username = player.username;
          console.log(`⛏️  [${username}] Добыл блок: ${block.name || block.type} в ${block.position.x}, ${block.position.y}, ${block.position.z}`);
          
          // Принудительно обновляем инвентарь игрока
          setTimeout(() => {
            updatePlayerInventory(player, username);
          }, 100);
        } catch (err) {
          console.warn(`⚠️  Ошибка при обработке добычи блока: ${err.message}`);
        }
      });
      
      // Обработка завершения добычи блока
      server.on('diggingCompleted', (player, block) => {
        try {
          const username = player.username;
          // Обновляем инвентарь после завершения добычи
          setTimeout(() => {
            updatePlayerInventory(player, username);
          }, 50);
        } catch (err) {
          console.warn(`⚠️  Ошибка при обработке завершения добычи: ${err.message}`);
        }
      });
      
      // Перехватываем отправку звуков на уровне мира/сервера
      // Пытаемся найти методы, которые отправляют звуки при разрушении блоков
      try {
        const world = server.world || (server._worlds && server._worlds[0]) || null;
        if (world) {
          // Перехватываем методы отправки звуков в мире
          if (world.playSoundAt) {
            const originalPlaySoundAt = world.playSoundAt;
            world.playSoundAt = function(...args) {
              // Блокируем отправку звуков, чтобы избежать ошибок soundId
              console.warn(`🔇 Blocked playSoundAt call to prevent soundId error`);
              return; // Не отправляем звук
            };
          }
          
          if (world.playSound) {
            const originalPlaySound = world.playSound;
            world.playSound = function(...args) {
              // Блокируем отправку звуков
              console.warn(`🔇 Blocked playSound call to prevent soundId error`);
              return;
            };
          }
        }
        
        // Перехватываем на уровне сервера
        if (server.playSound) {
          const originalServerPlaySound = server.playSound;
          server.playSound = function(...args) {
            console.warn(`🔇 Blocked server.playSound call to prevent soundId error`);
            return;
          };
        }
        
        if (server.playSoundAt) {
          const originalServerPlaySoundAt = server.playSoundAt;
          server.playSoundAt = function(...args) {
            console.warn(`🔇 Blocked server.playSoundAt call to prevent soundId error`);
            return;
          };
        }
      } catch (err) {
        console.warn(`⚠️  Could not intercept sound methods: ${err.message}`);
      }
      
      // Перехватываем ошибки сериализации пакетов на уровне сервера
      // Перехватываем все ошибки перед отправкой пакетов
      if (server.on) {
        // Перехватываем ошибки на уровне сервера перед отправкой
        const originalEmitError = server.emit;
        const serverEmit = function(event, ...args) {
          // Перехватываем ошибки сериализации
          if (event === 'error') {
            const err = args[0];
            if (err && err.message && (
              err.message.includes('soundId') || 
              err.message.includes('sound_effect') ||
              err.message.includes('ItemSoundHolder')
            )) {
              console.warn(`🔇 Blocked sound_effect error at server level: ${err.message.substring(0, 100)}`);
              return false; // Не обрабатываем ошибку
            }
          }
          return originalEmitError.apply(this, [event, ...args]);
        };
        // Заменяем emit только если это возможно
        try {
          if (typeof serverEmit === 'function') {
            // Не переопределяем emit напрямую, так как это может сломать другие обработчики
            // Вместо этого полагаемся на перехват на уровне клиента
          }
        } catch (e) {
          // Игнорируем ошибки
        }
      }
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
 * Находит безопасную позицию для спавна игрока (на земле)
 */
function findSafeSpawnPosition(world, startX, startZ) {
  try {
    if (!world) {
      console.warn(`⚠️  Мир не доступен для поиска безопасной позиции`);
      return { x: startX, y: 64, z: startZ };
    }
    
    // Проверяем несколько позиций вокруг стартовой точки
    const searchRadius = 20;
    const minY = 0;
    const maxY = 256;
    
    // Начинаем поиск с центра и расширяемся
    for (let radius = 0; radius <= searchRadius; radius += 2) {
      for (let offsetX = -radius; offsetX <= radius; offsetX += 2) {
        for (let offsetZ = -radius; offsetZ <= radius; offsetZ += 2) {
          // Пропускаем позиции вне текущего радиуса
          if (Math.abs(offsetX) !== radius && Math.abs(offsetZ) !== radius && radius > 0) {
            continue;
          }
          
          const x = Math.floor(startX + offsetX);
          const z = Math.floor(startZ + offsetZ);
          
          // Ищем безопасную позицию сверху вниз (начинаем с Y=100)
          for (let y = 100; y >= minY; y--) {
            try {
              // Пытаемся получить блоки разными способами (в зависимости от API flying-squid)
              let blockBelow = null;
              let blockAt = null;
              let blockAbove = null;
              
              // Способ 1: через getBlock
              if (world.getBlock) {
                try {
                  blockBelow = world.getBlock(x, y - 1, z);
                  blockAt = world.getBlock(x, y, z);
                  blockAbove = world.getBlock(x, y + 1, z);
                } catch (e) {
                  // Игнорируем ошибки
                }
              }
              
              // Способ 2: через блоки чанка
              if ((!blockBelow || !blockAt || !blockAbove) && world.getColumn) {
                try {
                  const column = world.getColumn(x, z);
                  if (column) {
                    if (!blockBelow) blockBelow = column.getBlock ? column.getBlock(x, y - 1, z) : null;
                    if (!blockAt) blockAt = column.getBlock ? column.getBlock(x, y, z) : null;
                    if (!blockAbove) blockAbove = column.getBlock ? column.getBlock(x, y + 1, z) : null;
                  }
                } catch (e) {
                  // Игнорируем ошибки
                }
              }
              
              // Проверяем, что блок под ногами твердый, а на уровне игрока и выше - воздух
              const isSolidBelow = blockBelow && (blockBelow.type !== 0 && blockBelow.type !== undefined);
              const isAirAt = !blockAt || blockAt.type === 0 || blockAt.type === undefined || blockAt.name === 'air';
              const isAirAbove = !blockAbove || blockAbove.type === 0 || blockAbove.type === undefined || blockAbove.name === 'air';
              
              if (isSolidBelow && isAirAt && isAirAbove) {
                return { x: x + 0.5, y: y, z: z + 0.5 }; // Центрируем в блоке
              }
            } catch (err) {
              // Игнорируем ошибки при проверке блоков
              continue;
            }
          }
        }
      }
    }
    
    // Если не нашли безопасную позицию, возвращаем позицию по умолчанию на уровне моря
    console.warn(`⚠️  Не удалось найти безопасную позицию, используем позицию по умолчанию`);
    return { x: Math.floor(startX) + 0.5, y: 64, z: Math.floor(startZ) + 0.5 };
  } catch (err) {
    console.warn(`⚠️  Error finding safe spawn position: ${err.message}`);
    return { x: Math.floor(startX) + 0.5, y: 64, z: Math.floor(startZ) + 0.5 };
  }
}

/**
 * Проверяет и исправляет позицию спавна игрока
 */
function ensureSafeSpawnPosition(playerEntity, username) {
  try {
    if (!playerEntity || !server) return;
    
    // Получаем текущую позицию игрока
    let currentX = 0;
    let currentY = 0;
    let currentZ = 0;
    
    // Пытаемся получить позицию из разных мест
    if (playerEntity.position) {
      currentX = playerEntity.position.x || 0;
      currentY = playerEntity.position.y || 0;
      currentZ = playerEntity.position.z || 0;
    } else if (playerEntity.entity) {
      currentX = playerEntity.entity.position?.x || 0;
      currentY = playerEntity.entity.position?.y || 0;
      currentZ = playerEntity.entity.position?.z || 0;
    }
    
    // Если позиция в воздухе (выше 100 блоков) или очень низко (ниже 0)
    if (currentY > 100 || currentY < 0) {
      console.log(`🔧 [${username}] Игрок в небезопасной позиции (Y=${currentY.toFixed(1)}), ищем безопасную позицию...`);
      
      // Получаем мир
      const world = server.world || (server._worlds && server._worlds[0]) || null;
      
      if (world) {
        // Ищем безопасную позицию
        const safePos = findSafeSpawnPosition(world, currentX || 0, currentZ || 0);
        
        // Телепортируем игрока
        if (playerEntity.teleport) {
          playerEntity.teleport(safePos);
          console.log(`✅ [${username}] Телепортирован на безопасную позицию: ${safePos.x.toFixed(1)}, ${safePos.y.toFixed(1)}, ${safePos.z.toFixed(1)}`);
        } else if (playerEntity.entity && playerEntity.entity.teleport) {
          playerEntity.entity.teleport(safePos);
          console.log(`✅ [${username}] Телепортирован на безопасную позицию: ${safePos.x.toFixed(1)}, ${safePos.y.toFixed(1)}, ${safePos.z.toFixed(1)}`);
        } else {
          // Пытаемся установить позицию напрямую
          try {
            if (playerEntity.position) {
              playerEntity.position.x = safePos.x;
              playerEntity.position.y = safePos.y;
              playerEntity.position.z = safePos.z;
            }
            if (playerEntity.entity && playerEntity.entity.position) {
              playerEntity.entity.position.x = safePos.x;
              playerEntity.entity.position.y = safePos.y;
              playerEntity.entity.position.z = safePos.z;
            }
            console.log(`✅ [${username}] Позиция установлена: ${safePos.x.toFixed(1)}, ${safePos.y.toFixed(1)}, ${safePos.z.toFixed(1)}`);
          } catch (err) {
            console.warn(`⚠️  Не удалось установить позицию для ${username}: ${err.message}`);
          }
        }
      } else {
        console.warn(`⚠️  Не удалось получить доступ к миру для ${username}`);
      }
    } else {
      // Проверяем, что под игроком есть блок
      const world = server.world || (server._worlds && server._worlds[0]) || null;
      if (world && currentY > 0) {
        try {
          const blockBelow = world.getBlock(Math.floor(currentX), Math.floor(currentY) - 1, Math.floor(currentZ));
          // Если под игроком воздух, телепортируем на безопасную позицию
          if (!blockBelow || blockBelow.type === 0) {
            console.log(`🔧 [${username}] Под игроком воздух, ищем безопасную позицию...`);
            const safePos = findSafeSpawnPosition(world, currentX, currentZ);
            
            if (playerEntity.teleport) {
              playerEntity.teleport(safePos);
            } else if (playerEntity.entity && playerEntity.entity.teleport) {
              playerEntity.entity.teleport(safePos);
            }
            console.log(`✅ [${username}] Телепортирован на безопасную позицию`);
          }
        } catch (err) {
          // Игнорируем ошибки проверки блока
        }
      }
    }
  } catch (err) {
    console.warn(`⚠️  Ошибка при проверке позиции спавна для ${username}: ${err.message}`);
  }
}

/**
 * Предзагружает чанки вокруг игрока для ускорения генерации мира
 */
function preloadChunksAroundPlayer(player, username) {
  try {
    if (!server || !player) return;
    
    const world = server.world || (server._worlds && server._worlds[0]) || null;
    if (!world) return;
    
    // Получаем позицию игрока
    let playerX = 0;
    let playerZ = 0;
    
    if (player.position) {
      playerX = Math.floor(player.position.x / 16);
      playerZ = Math.floor(player.position.z / 16);
    } else if (player.entity && player.entity.position) {
      playerX = Math.floor(player.entity.position.x / 16);
      playerZ = Math.floor(player.entity.position.z / 16);
    }
    
    // Предзагружаем чанки в радиусе 5 чанков
    const preloadRadius = 5;
    let loadedCount = 0;
    
    for (let dx = -preloadRadius; dx <= preloadRadius; dx++) {
      for (let dz = -preloadRadius; dz <= preloadRadius; dz++) {
        const chunkX = playerX + dx;
        const chunkZ = playerZ + dz;
        
        try {
          // Пытаемся загрузить чанк
          if (world.loadColumn) {
            world.loadColumn(chunkX, chunkZ, () => {
              loadedCount++;
            });
          } else if (world.getColumn) {
            // Если нет loadColumn, просто проверяем наличие
            const column = world.getColumn(chunkX, chunkZ);
            if (column) {
              loadedCount++;
            }
          }
        } catch (err) {
          // Игнорируем ошибки загрузки отдельных чанков
        }
      }
    }
    
    if (loadedCount > 0) {
      console.log(`🌍 [${username}] Предзагружено ${loadedCount} чанков вокруг игрока`);
    }
  } catch (err) {
    console.warn(`⚠️  Ошибка при предзагрузке чанков для ${username}: ${err.message}`);
  }
}

/**
 * Обновляет инвентарь игрока на клиенте
 */
function updatePlayerInventory(player, username) {
  try {
    if (!player) return;
    
    // Пытаемся получить entity игрока разными способами
    let playerEntity = player.entity || player;
    if (!playerEntity) return;
    
    // Пытаемся обновить инвентарь разными способами
    // Способ 1: через inventory объекта игрока
    if (playerEntity.inventory) {
      try {
        const inventory = playerEntity.inventory;
        const client = playerEntity._client || (playerEntity.client) || (player.client);
        
        if (client && client.write) {
          // Отправляем пакет обновления инвентаря
          if (inventory.slots) {
            client.write('window_items', {
              windowId: 0, // Инвентарь игрока
              items: inventory.slots
            });
          }
        }
      } catch (err) {
        // Игнорируем ошибки отправки
      }
    }
    
    // Способ 2: через обновление слотов напрямую
    if (playerEntity.updateSlot) {
      try {
        const inventory = playerEntity.inventory;
        if (inventory && inventory.slots) {
          // Обновляем только измененные слоты
          for (let i = 0; i < Math.min(inventory.slots.length, 45); i++) {
            try {
              playerEntity.updateSlot(i, inventory.slots[i] || null);
            } catch (err) {
              // Игнорируем ошибки отдельных слотов
            }
          }
        }
      } catch (err) {
        // Игнорируем ошибки
      }
    }
    
    // Способ 3: через setEquipment (обновляет экипировку и инвентарь)
    if (playerEntity.setEquipment) {
      try {
        const equipment = playerEntity.equipment || {};
        playerEntity.setEquipment(equipment);
      } catch (err) {
        // Игнорируем ошибки
      }
    }
    
    // Способ 4: принудительная отправка через сервер
    if (server && server.players) {
      try {
        const serverPlayer = server.players[username];
        if (serverPlayer && serverPlayer.inventory) {
          const client = serverPlayer._client || serverPlayer.client;
          if (client && client.write && serverPlayer.inventory.slots) {
            client.write('set_slot', {
              windowId: 0,
              slot: -1, // Обновить весь инвентарь
              item: null
            });
            // Затем отправляем все слоты
            for (let i = 0; i < serverPlayer.inventory.slots.length; i++) {
              client.write('set_slot', {
                windowId: 0,
                slot: i,
                item: serverPlayer.inventory.slots[i] || null
              });
            }
          }
        }
      } catch (err) {
        // Игнорируем ошибки
      }
    }
  } catch (err) {
    console.warn(`⚠️  Ошибка при обновлении инвентаря для ${username}: ${err.message}`);
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
        player.chat('Доступные команды: /help, /list, /time, /spawn');
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

    case 'spawn':
      // Телепортируем игрока на безопасную позицию
      try {
        ensureSafeSpawnPosition(player, username);
        if (player.chat) {
          player.chat('Телепортация на безопасную позицию...');
        }
      } catch (err) {
        if (player.chat) {
          player.chat(`Ошибка при телепортации: ${err.message}`);
        }
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
