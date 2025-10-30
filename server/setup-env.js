const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupEnv() {
  console.log('🔧 Настройка переменных окружения для SMTP\n');
  
  const envPath = path.join(__dirname, '.env');
  const examplePath = path.join(__dirname, 'env.example');
  
  // Проверяем, существует ли .env файл
  if (fs.existsSync(envPath)) {
    const overwrite = await question('Файл .env уже существует. Перезаписать? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('❌ Отмена настройки');
      rl.close();
      return;
    }
  }
  
  console.log('📧 Настройка SMTP для отправки email\n');
  
  // Читаем пример файла
  let envContent = fs.readFileSync(examplePath, 'utf8');
  
  // Настройка SMTP
  console.log('Выберите SMTP провайдера:');
  console.log('1. Gmail (рекомендуется для разработки)');
  console.log('2. Yandex (рекомендуется для продакшена)');
  console.log('3. Другой (настройка вручную)');
  
  const provider = await question('Введите номер (1-3): ');
  
  let smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom;
  
  switch (provider) {
    case '1':
      smtpHost = 'smtp.gmail.com';
      smtpPort = '587';
      smtpUser = await question('Gmail email: ');
      smtpPass = await question('Пароль приложения (16 символов): ');
      smtpFrom = await question('От кого отправлять (например: noreply@yourcompany.com): ');
      break;
      
    case '2':
      smtpHost = 'smtp.yandex.ru';
      smtpPort = '587';
      smtpUser = await question('Yandex email: ');
      smtpPass = await question('Пароль приложения: ');
      smtpFrom = await question('От кого отправлять (например: noreply@yourcompany.com): ');
      break;
      
    case '3':
      smtpHost = await question('SMTP хост: ');
      smtpPort = await question('SMTP порт: ');
      smtpUser = await question('SMTP пользователь: ');
      smtpPass = await question('SMTP пароль: ');
      smtpFrom = await question('От кого отправлять: ');
      break;
      
    default:
      console.log('❌ Неверный выбор');
      rl.close();
      return;
  }
  
  // Обновляем переменные в контенте
  envContent = envContent.replace(/SMTP_HOST=.*/, `SMTP_HOST=${smtpHost}`);
  envContent = envContent.replace(/SMTP_PORT=.*/, `SMTP_PORT=${smtpPort}`);
  envContent = envContent.replace(/SMTP_USER=.*/, `SMTP_USER=${smtpUser}`);
  envContent = envContent.replace(/SMTP_PASS=.*/, `SMTP_PASS=${smtpPass}`);
  envContent = envContent.replace(/SMTP_FROM=.*/, `SMTP_FROM=${smtpFrom}`);
  
  // Записываем .env файл
  fs.writeFileSync(envPath, envContent);
  
  console.log('\n✅ Файл .env создан успешно!');
  console.log('\n📋 Следующие шаги:');
  console.log('1. Проверьте настройки: node test-smtp.js');
  console.log('2. Запустите сервер: npm start');
  console.log('3. Протестируйте регистрацию');
  
  rl.close();
}

setupEnv().catch(console.error);
