/**
 * Скрипт для отправки команд в консоль Minecraft сервера
 * Использование: node send-mc-command.js "команда"
 * 
 * Примеры:
 * node send-mc-command.js "op Samidius"
 * node send-mc-command.js "say Привет всем!"
 * node send-mc-command.js "guildadmin spawn"
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Получаем команду из аргументов
const command = process.argv[2];

if (!command) {
  console.error('❌ Ошибка: Укажите команду для отправки');
  console.log('Использование: node send-mc-command.js "команда"');
  console.log('Примеры:');
  console.log('  node send-mc-command.js "op Samidius"');
  console.log('  node send-mc-command.js "say Привет всем!"');
  process.exit(1);
}

// Путь к файлу сервера
const serverDir = path.join(__dirname, 'mcraft');
const jarPath = path.join(serverDir, 'server.jar');

// Проверяем наличие файла сервера
if (!fs.existsSync(jarPath)) {
  // Пробуем найти другие варианты
  const files = fs.readdirSync(serverDir).filter(f => f.endsWith('.jar'));
  if (files.length === 0) {
    console.error('❌ Ошибка: Файл сервера не найден!');
    process.exit(1);
  }
}

// Ищем процесс Java с Minecraft сервером
const { exec } = require('child_process');

// Получаем PID процесса minecraft-server через PM2
exec('pm2 jlist', (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Ошибка при получении списка процессов PM2:', error.message);
    console.log('\n💡 Альтернативный способ:');
    console.log('1. Найдите PID процесса: ps aux | grep java | grep minecraft');
    console.log('2. Отправьте команду напрямую: echo "команда" > /proc/PID/fd/0');
    process.exit(1);
  }

  try {
    const processes = JSON.parse(stdout);
    const mcProcess = processes.find(p => p.name === 'minecraft-server');
    
    if (!mcProcess) {
      console.error('❌ Ошибка: Процесс minecraft-server не найден в PM2');
      console.log('Проверьте статус: pm2 status');
      process.exit(1);
    }

    // Получаем PID основного процесса
    const pid = mcProcess.pid;
    
    // Ищем дочерний процесс Java
    exec(`pgrep -P ${pid}`, (err, javaPid) => {
      if (err || !javaPid) {
        // Если не нашли дочерний процесс, используем основной PID
        const targetPid = pid;
        sendCommandToProcess(targetPid, command);
      } else {
        // Используем PID дочернего процесса Java
        sendCommandToProcess(javaPid.trim(), command);
      }
    });
  } catch (parseError) {
    console.error('❌ Ошибка при парсинге вывода PM2:', parseError.message);
    process.exit(1);
  }
});

function sendCommandToProcess(pid, cmd) {
  // Создаем именованный канал для отправки команды
  const fifoPath = `/tmp/mc-command-${pid}.fifo`;
  
  // Пробуем отправить команду через /proc/PID/fd/0
  const procPath = `/proc/${pid}/fd/0`;
  
  fs.access(procPath, fs.constants.F_OK, (err) => {
    if (err) {
      // Альтернативный способ - через временный файл
      console.log(`📤 Отправка команды "${cmd}" в процесс ${pid}...`);
      
      // Используем другой подход - создаем скрипт, который PM2 может выполнить
      console.log('⚠️  Прямая отправка команды в stdin процесса через PM2 не поддерживается.');
      console.log('\n💡 Рекомендуемые способы:');
      console.log('\n1. Через игру (если вы уже в игре):');
      console.log(`   Просто введите команду в чат: ${cmd}`);
      console.log('\n2. Через RCON (если включен):');
      console.log('   Включите RCON в server.properties:');
      console.log('   enable-rcon=true');
      console.log('   rcon.port=25575');
      console.log('   rcon.password=ваш_пароль');
      console.log('   Затем используйте: mcrcon -H localhost -P 25575 -p пароль "команда"');
      console.log('\n3. Временно остановите PM2 и запустите сервер вручную:');
      console.log('   pm2 stop minecraft-server');
      console.log('   cd server/mcraft');
      console.log('   java -Xmx1024M -Xms1024M -jar server.jar nogui');
      console.log('   (Затем введите команду напрямую в консоль)');
      process.exit(1);
    } else {
      // Пробуем отправить команду
      try {
        const writeStream = fs.createWriteStream(procPath);
        writeStream.write(cmd + '\n');
        writeStream.end();
        console.log(`✅ Команда "${cmd}" отправлена в процесс ${pid}`);
        setTimeout(() => process.exit(0), 100);
      } catch (writeError) {
        console.error('❌ Ошибка при отправке команды:', writeError.message);
        console.log('\n💡 Используйте альтернативные способы (см. выше)');
        process.exit(1);
      }
    }
  });
}

