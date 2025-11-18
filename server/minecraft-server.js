const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const minecraftService = require('./services/minecraftService');

const MINECRAFT_PORT = parseInt(process.env.MINECRAFT_PORT || '27015');
const SERVER_VERSION = process.env.MINECRAFT_VERSION || '1.21.10';
const SERVER_MOTD = process.env.MINECRAFT_MOTD || 'Minecraft Server';
const MAX_PLAYERS = parseInt(process.env.MINECRAFT_MAX_PLAYERS || '20');
const ONLINE_MODE = process.env.MINECRAFT_ONLINE_MODE === 'true';
const MIN_MEMORY = process.env.MINECRAFT_MIN_MEMORY || '1024M';
const MAX_MEMORY = process.env.MINECRAFT_MAX_MEMORY || '1024M';

let serverProcess = null;
let serverDir = null;

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
