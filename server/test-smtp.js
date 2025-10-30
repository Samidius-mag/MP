const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Загружаем настройки из env.example
function loadEnvExample() {
  const envExamplePath = path.join(__dirname, 'env.example');
  const envContent = fs.readFileSync(envExamplePath, 'utf8');
  
  const config = {};
  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        config[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  
  return config;
}

async function testSMTP() {
  console.log('🔧 Проверка настроек SMTP из env.example...');
  
  // Загружаем настройки из env.example
  const config = loadEnvExample();
  
  // Проверяем наличие необходимых переменных
  const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];
  const missingVars = requiredVars.filter(varName => !config[varName] || config[varName].includes('your-'));
  
  if (missingVars.length > 0) {
    console.error('❌ В env.example отсутствуют или не настроены переменные:', missingVars.join(', '));
    console.log('📝 Отредактируйте файл env.example и замените значения на реальные');
    return;
  }

  console.log('📧 Настройки SMTP:');
  console.log(`   Host: ${config.SMTP_HOST}`);
  console.log(`   Port: ${config.SMTP_PORT}`);
  console.log(`   User: ${config.SMTP_USER}`);
  console.log(`   From: ${config.SMTP_FROM}`);

  // Создаем транспортер
  const transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: parseInt(config.SMTP_PORT),
    secure: false, // true для порта 465, false для других портов
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS
    }
  });

  try {
    console.log('\n🔍 Проверка подключения к SMTP серверу...');
    await transporter.verify();
    console.log('✅ SMTP сервер настроен корректно');
    
    console.log('\n📤 Отправка тестового письма...');
    const info = await transporter.sendMail({
      from: config.SMTP_FROM,
      to: config.SMTP_USER, // Отправляем себе
      subject: 'Тест SMTP - Код подтверждения',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Тест SMTP сервера</h2>
          <p>Здравствуйте!</p>
          <p>Это тестовое письмо для проверки настройки SMTP сервера.</p>
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #007bff; font-size: 32px; margin: 0; letter-spacing: 5px;">123456</h1>
          </div>
          <p>Если вы видите это письмо, SMTP настроен корректно!</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">Это автоматическое сообщение, не отвечайте на него.</p>
        </div>
      `
    });
    
    console.log('✅ Тестовое письмо отправлено успешно!');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Response: ${info.response}`);
    
    console.log('\n🎉 SMTP настроен и работает корректно!');
    console.log('📧 Проверьте свою почту для подтверждения.');
    
  } catch (error) {
    console.error('❌ Ошибка SMTP:', error.message);
    
    if (error.code === 'EAUTH') {
      console.log('\n💡 Возможные решения:');
      console.log('   1. Проверьте правильность email и пароля');
      console.log('   2. Убедитесь, что включена 2FA в Google аккаунте');
      console.log('   3. Используйте пароль приложения, а не основной пароль');
    } else if (error.code === 'ECONNECTION') {
      console.log('\n💡 Возможные решения:');
      console.log('   1. Проверьте настройки хоста и порта');
      console.log('   2. Убедитесь, что SMTP включен у провайдера');
      console.log('   3. Проверьте firewall и сетевое подключение');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('\n💡 Возможные решения:');
      console.log('   1. Проверьте интернет-соединение');
      console.log('   2. Попробуйте другой порт (465 для SSL)');
      console.log('   3. Проверьте настройки прокси');
    }
  }
}

// Запуск теста
testSMTP().catch(console.error);
