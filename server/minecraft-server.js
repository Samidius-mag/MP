const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const minecraftService = require('./services/minecraftService');
const minecraftTimeService = require('./services/minecraftTimeService');

const MINECRAFT_PORT = parseInt(process.env.MINECRAFT_PORT || '27015');
const SERVER_VERSION = process.env.MINECRAFT_VERSION || '1.21.10';
const SERVER_MOTD = process.env.MINECRAFT_MOTD || 'Minecraft Server';
const MAX_PLAYERS = parseInt(process.env.MINECRAFT_MAX_PLAYERS || '20');
const ONLINE_MODE = process.env.MINECRAFT_ONLINE_MODE === 'true';
const MIN_MEMORY = process.env.MINECRAFT_MIN_MEMORY || '1024M';
const MAX_MEMORY = process.env.MINECRAFT_MAX_MEMORY || '1024M';
const SERVER_NAME = process.env.MINECRAFT_SERVER_NAME || 'Minecraft Server';
const SERVER_DESCRIPTION = process.env.MINECRAFT_SERVER_DESCRIPTION || '';

let serverProcess = null;
let serverDir = null;

/**
 * Создает или обновляет server.properties с красивым MOTD
 * Поддерживает цветовые коды Minecraft (§)
 */
function configureServerProperties(serverDirPath) {
  const serverPropertiesPath = path.join(serverDirPath, 'server.properties');
  
  // Функция для конвертации цветовых кодов из env в формат Minecraft
  // Поддерживает как § коды, так и простой текст
  function formatMOTD(motd) {
    if (!motd) return 'Minecraft Server';
    
    // Если уже есть § коды, используем как есть
    if (motd.includes('§')) {
      return motd;
    }
    
    // Если это простой текст, создаем красивый формат
    // Пример: "VIMEMC" -> "§6§lVIMEMC"
    return `§6§l${motd}§r`;
  }
  
  // Создаем красивое MOTD
  let motdLine1 = formatMOTD(SERVER_NAME);
  let motdLine2 = SERVER_DESCRIPTION || '§7Добро пожаловать на сервер!';
  
  // Если MOTD содержит \n, разделяем на две строки
  if (SERVER_MOTD.includes('\\n')) {
    const parts = SERVER_MOTD.split('\\n');
    motdLine1 = formatMOTD(parts[0] || SERVER_NAME);
    motdLine2 = formatMOTD(parts[1] || SERVER_DESCRIPTION || '§7Добро пожаловать!');
  } else if (SERVER_MOTD !== 'Minecraft Server' && SERVER_MOTD !== SERVER_NAME) {
    motdLine1 = formatMOTD(SERVER_MOTD);
  }
  
  // Читаем существующий server.properties или создаем новый
  let properties = {};
  
  if (fs.existsSync(serverPropertiesPath)) {
    const content = fs.readFileSync(serverPropertiesPath, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key) {
          properties[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
  }
  
  // Обновляем настройки
  properties['server-port'] = MINECRAFT_PORT.toString();
  properties['max-players'] = MAX_PLAYERS.toString();
  properties['online-mode'] = ONLINE_MODE.toString();
  properties['motd'] = `${motdLine1}\n${motdLine2}`;
  
  // Сохраняем server.properties
  const propertiesLines = [
    '# Minecraft Server Properties',
    '# Generated automatically by minecraft-server.js',
    '#',
    `server-port=${properties['server-port']}`,
    `max-players=${properties['max-players']}`,
    `online-mode=${properties['online-mode']}`,
    `motd=${properties['motd']}`,
    '',
    '# World Settings',
    `level-name=${properties['level-name'] || 'world'}`,
    `level-seed=${properties['level-seed'] || ''}`,
    `level-type=${properties['level-type'] || 'minecraft:normal'}`,
    '',
    '# Server Settings',
    `difficulty=${properties['difficulty'] || 'easy'}`,
    `gamemode=${properties['gamemode'] || 'survival'}`,
    `force-gamemode=${properties['force-gamemode'] || 'false'}`,
    `hardcore=${properties['hardcore'] || 'false'}`,
    `pvp=${properties['pvp'] || 'true'}`,
    `spawn-monsters=${properties['spawn-monsters'] || 'true'}`,
    `spawn-npcs=${properties['spawn-npcs'] || 'true'}`,
    `spawn-animals=${properties['spawn-animals'] || 'true'}`,
    `generate-structures=${properties['generate-structures'] || 'true'}`,
    '',
    '# Network Settings',
    `network-compression-threshold=${properties['network-compression-threshold'] || '256'}`,
    `max-world-size=${properties['max-world-size'] || '29999984'}`,
    '',
    '# Performance',
    `view-distance=${properties['view-distance'] || '10'}`,
    `simulation-distance=${properties['simulation-distance'] || '10'}`,
    `max-tick-time=${properties['max-tick-time'] || '60000'}`,
    '',
    '# Other Settings',
    `enable-command-block=${properties['enable-command-block'] || 'false'}`,
    `enable-query=${properties['enable-query'] || 'false'}`,
    `enable-rcon=${properties['enable-rcon'] || 'false'}`,
    `white-list=${properties['white-list'] || 'false'}`,
    `enforce-whitelist=${properties['enforce-whitelist'] || 'false'}`,
  ];
  
  fs.writeFileSync(serverPropertiesPath, propertiesLines.join('\n'), 'utf8');
  console.log(`✅ Server properties configured: ${serverPropertiesPath}`);
  console.log(`   MOTD Line 1: ${motdLine1.replace(/§./g, '')}`);
  console.log(`   MOTD Line 2: ${motdLine2.replace(/§./g, '')}`);
  
  // Проверяем наличие иконки сервера
  const serverIconPath = path.join(serverDirPath, 'server-icon.png');
  if (fs.existsSync(serverIconPath)) {
    console.log(`✅ Server icon found: server-icon.png`);
  } else {
    console.log(`⚠️  Server icon not found: server-icon.png`);
    console.log(`   💡 To add a server icon:`);
    console.log(`      1. Create a 64x64 pixel PNG image`);
    console.log(`      2. Save it as 'server-icon.png' in ${serverDirPath}`);
    console.log(`      3. Restart the server`);
  }
}

/**
 * Создает и запускает официальный Minecraft сервер через Java
 */
async function startMinecraftServer() {
  if (serverProcess) {
    console.log('⚠️  Minecraft server is already running');
    return;
  }

  try {
    console.log(`🎮 Starting official Minecraft server ${SERVER_VERSION}...`);
    console.log(`📋 Version: ${SERVER_VERSION}`);
    console.log(`👥 Max players: ${MAX_PLAYERS}`);
    console.log(`🔐 Online mode: ${ONLINE_MODE ? 'ENABLED (license check)' : 'DISABLED (cracked allowed)'}`);
    console.log(`💾 Memory: ${MIN_MEMORY} - ${MAX_MEMORY}`);

    // Определяем путь к папке с сервером
    serverDir = path.join(__dirname, 'mcraft');
    
    // Проверяем существование папки
    if (!fs.existsSync(serverDir)) {
      throw new Error(`Server directory not found: ${serverDir}`);
    }

    // Ищем файл сервера (пробуем несколько вариантов)
    let serverJarPath = null;
    
    // Вариант 1: server.jar
    const serverJar = path.join(serverDir, 'server.jar');
    if (fs.existsSync(serverJar)) {
      serverJarPath = serverJar;
      console.log(`📦 Found server file: server.jar`);
    } else {
      // Вариант 2: minecraft_server.1.21.10.jar (с версией)
      const versionedJar = path.join(serverDir, `minecraft_server.${SERVER_VERSION}.jar`);
      if (fs.existsSync(versionedJar)) {
        serverJarPath = versionedJar;
        console.log(`📦 Found versioned server file: minecraft_server.${SERVER_VERSION}.jar`);
      } else {
        // Вариант 3: ищем любой файл minecraft_server.*.jar
        const files = fs.readdirSync(serverDir);
        const minecraftServerFile = files.find(f => 
          f.startsWith('minecraft_server.') && f.endsWith('.jar')
        );
        if (minecraftServerFile) {
          serverJarPath = path.join(serverDir, minecraftServerFile);
          console.log(`📦 Found server file: ${minecraftServerFile}`);
        }
      }
    }
    
    // Проверяем, что файл найден
    if (!serverJarPath) {
      throw new Error(
        `Server JAR file not found in ${serverDir}.\n` +
        `Expected one of:\n` +
        `  - server.jar\n` +
        `  - minecraft_server.${SERVER_VERSION}.jar\n` +
        `  - minecraft_server.*.jar\n` +
        `\nPlease download the server from: https://www.minecraft.net/en-us/download/server`
      );
    }
    
    // Настраиваем server.properties перед запуском
    configureServerProperties(serverDir);
    
    // Запускаем сервер
    await startJavaServer(serverJarPath);

  } catch (err) {
    console.error('❌ Failed to start Minecraft server:', err);
    minecraftService.isRunning = false;
    throw err;
  }
}

/**
 * Запускает Java процесс с сервером
 */
async function startJavaServer(jarPath) {
  return new Promise((resolve, reject) => {
    let serverReady = false;
    
    // Проверяем наличие Java
    let javaCommand = 'java';
    if (process.env.JAVA_HOME) {
      // Используем правильные разделители путей для текущей ОС
      javaCommand = path.join(process.env.JAVA_HOME, 'bin', 'java');
      // На Windows нужно добавить .exe
      if (process.platform === 'win32') {
        javaCommand += '.exe';
      }
    }

    // Формируем команду согласно документации
    // java -Xmx1024M -Xms1024M -jar minecraft_server.1.21.10.jar nogui
    const args = [
      `-Xmx${MAX_MEMORY}`,
      `-Xms${MIN_MEMORY}`,
      '-jar',
      jarPath,
      'nogui'
    ];

    console.log(`🚀 Executing: ${javaCommand} ${args.join(' ')}`);
    console.log(`📁 Working directory: ${serverDir}`);

    // Запускаем процесс
    serverProcess = spawn(javaCommand, args, {
      cwd: serverDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false
    });

    // Обработка вывода сервера
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      process.stdout.write(`[MC Server] ${output}`);
      
      // Парсим вывод для определения статуса сервера
      // Официальный сервер выводит "Done" когда готов
      if (!serverReady && (output.includes('Done') || output.includes('For help, type "help"'))) {
        serverReady = true;
        console.log('✅ Minecraft server started successfully!');
        minecraftService.isRunning = true;
        minecraftService.server = serverProcess;
        
        // Запускаем сервис отображения времени после небольшой задержки
        // (чтобы дать серверу время полностью загрузиться)
        setTimeout(() => {
          try {
            minecraftTimeService.start();
          } catch (err) {
            console.warn('⚠️  Failed to start time display service:', err.message);
          }
        }, 5000);
        
        resolve();
      }
      
      // Отслеживаем подключения игроков
      if (output.includes('joined the game')) {
        const match = output.match(/(\w+) joined the game/);
        if (match) {
          const username = match[1];
          console.log(`✅ Player connected: ${username}`);
          // Можно добавить логику отслеживания игроков
        }
      }
      
      // Отслеживаем отключения игроков
      if (output.includes('left the game')) {
        const match = output.match(/(\w+) left the game/);
        if (match) {
          const username = match[1];
          console.log(`❌ Player disconnected: ${username}`);
        }
      }
    });

    serverProcess.stderr.on('data', (data) => {
      const error = data.toString();
      process.stderr.write(`[MC Server Error] ${error}`);
      
      // Некоторые предупреждения можно игнорировать
      if (error.includes('WARN') || error.includes('Warning')) {
        // Это просто предупреждения, не критично
        return;
      }
    });

    // Обработка завершения процесса
    serverProcess.on('exit', (code, signal) => {
      console.log(`🛑 Minecraft server process exited with code ${code}${signal ? ` and signal ${signal}` : ''}`);
      serverProcess = null;
      minecraftService.isRunning = false;
      minecraftService.server = null;
      
      // Останавливаем сервис отображения времени
      try {
        minecraftTimeService.stop();
      } catch (err) {
        console.warn('⚠️  Error stopping time display service:', err.message);
      }
      
      // Если сервер упал неожиданно, можно попробовать перезапустить
      if (code !== 0 && code !== null) {
        console.error(`❌ Server crashed with exit code ${code}`);
      }
    });

    serverProcess.on('error', (err) => {
      console.error('❌ Failed to start Minecraft server process:', err);
      
      if (err.code === 'ENOENT') {
        console.error('💡 Java is not installed or not in PATH');
        console.error('💡 Please install Java 21 or set JAVA_HOME environment variable');
        console.error('💡 For Minecraft 1.21.10, you need Java 21');
      }
      
      serverProcess = null;
      minecraftService.isRunning = false;
      reject(err);
    });

    // Проверяем, что процесс запустился
    if (!serverProcess.pid) {
      reject(new Error('Failed to start server process'));
    } else {
      console.log(`✅ Server process started with PID: ${serverProcess.pid}`);
      
      // Даем серверу время на запуск
      // Если через 60 секунд сервер не запустился, предупреждаем (но не завершаем)
      setTimeout(() => {
        if (!serverReady && !minecraftService.isRunning) {
          console.warn('⚠️  Server is taking longer than expected to start...');
          console.warn('⚠️  This is normal for the first start (world generation)');
          console.warn('⚠️  Check the logs above for any errors');
          console.warn('⚠️  Server may still be starting, wait a bit more...');
        }
      }, 60000);
    }
  });
}

/**
 * Останавливает Minecraft сервер
 */
function stopMinecraftServer() {
  if (!serverProcess) {
    console.log('⚠️  Minecraft server is not running');
    return;
  }

  try {
    console.log('🛑 Stopping Minecraft server...');
    
    // Отправляем команду stop в консоль сервера
    if (serverProcess.stdin && !serverProcess.stdin.destroyed) {
      serverProcess.stdin.write('stop\n');
      serverProcess.stdin.end();
    }
    
    // Ждем завершения процесса (максимум 10 секунд)
    const killTimeout = setTimeout(() => {
      if (serverProcess && serverProcess.kill) {
        console.log('⚠️  Server did not stop gracefully, forcing termination...');
        serverProcess.kill('SIGKILL');
      }
    }, 10000);
    
    serverProcess.on('exit', () => {
      clearTimeout(killTimeout);
      console.log('✅ Minecraft server stopped');
      minecraftService.isRunning = false;
      minecraftService.server = null;
      serverProcess = null;
      
      // Останавливаем сеeрвис отображения времени
      try {
        minecraftTimeService.stop();
      } catch (err) {
        console.warn('⚠️  Error stopping time display service:', err.message);
      }
    });
    
    // Если процесс уже завершился
    if (serverProcess.killed || !serverProcess.pid) {
      clearTimeout(killTimeout);
      console.log('✅ Minecraft server stopped');
      minecraftService.isRunning = false;
      minecraftService.server = null;
      serverProcess = null;
    }
  } catch (err) {
    console.error('❌ Error stopping Minecraft server:', err);
    // Принудительно завершаем процесс
    if (serverProcess && serverProcess.kill) {
      serverProcess.kill('SIGKILL');
    }
    minecraftService.isRunning = false;
    minecraftService.server = null;
    serverProcess = null;
    throw err;
  }
}

/**
 * Отправляет команду в консоль сервера
 */
function sendCommand(command) {
  if (!serverProcess || !serverProcess.stdin || serverProcess.stdin.destroyed) {
    console.error('❌ Server is not running or stdin is not available');
    return false;
  }
  
  try {
    serverProcess.stdin.write(command + '\n');
    return true;
  } catch (err) {
    console.error('❌ Error sending command to server:', err);
    return false;
  }
}

/**
 * Проверяет, запущен ли сервер
 */
function isServerRunning() {
  return serverProcess !== null && serverProcess.pid !== undefined && !serverProcess.killed;
}

// Обработка завершения процесса Node.js
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  stopMinecraftServer();
  setTimeout(() => process.exit(0), 2000);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  stopMinecraftServer();
  setTimeout(() => process.exit(0), 2000);
});

module.exports = {
  startMinecraftServer,
  stopMinecraftServer,
  sendCommand,
  isServerRunning,
  getServer: () => serverProcess
};
