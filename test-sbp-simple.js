#!/usr/bin/env node

/**
 * Упрощенный скрипт для тестирования СБП интеграции
 * Сначала пытается войти, потом регистрирует
 */

const axios = require('axios');

// Конфигурация
const config = {
  serverUrl: process.env.SERVER_URL || 'http://localhost:5000',
  testEmail: 'test@example.com',
  testPassword: 'TestPassword123!',
  testAmount: 1000 // 10 ₽ в копейках
};

// Цвета для консоли
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testSbpSimple() {
  log('\n🧪 Упрощенное тестирование СБП', 'bold');
  log('================================', 'blue');

  try {
    // 1. Проверка сервера
    log('\n1. Проверка сервера...', 'yellow');
    try {
      await axios.get(`${config.serverUrl}/api/health`);
      log('✅ Сервер доступен', 'green');
    } catch (error) {
      log('❌ Сервер недоступен', 'red');
      return;
    }

    // 2. Попытка входа
    log('\n2. Попытка входа...', 'yellow');
    let authToken;
    
    try {
      const loginResponse = await axios.post(`${config.serverUrl}/api/auth/login`, {
        email: config.testEmail,
        password: config.testPassword
      });
      authToken = loginResponse.data.token;
      log('✅ Вход выполнен', 'green');
    } catch (loginError) {
      log('⚠️  Вход не удался, пробуем регистрацию...', 'yellow');
      
      // 3. Регистрация
      log('\n3. Регистрация нового пользователя...', 'yellow');
      try {
        const registerData = {
          email: config.testEmail,
          password: config.testPassword,
          firstName: 'Test',
          lastName: 'User',
          phone: '+79001234567',
          inn: '1234567890',
          companyData: {
            companyName: 'Test Company',
            inn: '1234567890',
            address: 'Test Address'
          },
          termsAccepted: 'true'
        };

        const registerResponse = await axios.post(`${config.serverUrl}/api/auth/register`, registerData);
        authToken = registerResponse.data.token;
        log('✅ Пользователь зарегистрирован', 'green');
      } catch (registerError) {
        log('❌ Ошибка регистрации', 'red');
        if (registerError.response?.data) {
          log(`Детали: ${JSON.stringify(registerError.response.data, null, 2)}`, 'red');
        }
        return;
      }
    }

    // 4. Тест СБП платежа
    log('\n4. Тест СБП платежа...', 'yellow');
    try {
      const paymentResponse = await axios.post(`${config.serverUrl}/api/payment/deposit`, {
        amount: config.testAmount / 100, // Конвертируем в рубли
        payment_method: 'sbp'
      }, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      const { paymentUrl, paymentId, depositId } = paymentResponse.data;
      
      if (paymentUrl && paymentUrl.type === 'sbp') {
        log('✅ СБП платеж создан', 'green');
        log(`   ID заказа: ${paymentUrl.orderId}`, 'blue');
        log(`   Сумма: ${paymentUrl.amount} ₽`, 'blue');
        
        if (paymentUrl.qrCode) {
          log('   QR-код: сгенерирован', 'blue');
        }
        
        if (paymentUrl.paymentUrl) {
          log(`   URL оплаты: ${paymentUrl.paymentUrl}`, 'blue');
        }

        // 5. Проверка статуса
        log('\n5. Проверка статуса...', 'yellow');
        try {
          const statusResponse = await axios.get(`${config.serverUrl}/api/payment/sbp-status/${paymentUrl.orderId}`, {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          });

          const { status, localStatus, balance } = statusResponse.data;
          log('✅ Статус получен', 'green');
          log(`   Статус ВТБ: ${status}`, 'blue');
          log(`   Локальный статус: ${localStatus}`, 'blue');
          log(`   Баланс: ${balance} ₽`, 'blue');
        } catch (statusError) {
          log('⚠️  Ошибка проверки статуса', 'yellow');
          log(`Ошибка: ${statusError.response?.data?.error || statusError.message}`, 'yellow');
        }

      } else {
        log('❌ Ошибка создания СБП платежа', 'red');
        log(`Ответ: ${JSON.stringify(paymentResponse.data, null, 2)}`, 'red');
      }
    } catch (error) {
      log('❌ Ошибка создания платежа', 'red');
      log(`Ошибка: ${error.response?.data?.error || error.message}`, 'red');
      
      if (error.response?.data?.error?.includes('VTB')) {
        log('\n💡 Возможные причины:', 'yellow');
        log('   - Неправильные настройки ВТБ API', 'yellow');
        log('   - Отсутствуют переменные окружения', 'yellow');
        log('   - Проблемы с сетью', 'yellow');
      }
    }

    log('\n🎉 Тестирование завершено!', 'bold');

  } catch (error) {
    log('\n❌ Критическая ошибка', 'red');
    log(`Ошибка: ${error.message}`, 'red');
  }
}

// Запуск
if (require.main === module) {
  testSbpSimple().catch(console.error);
}

module.exports = { testSbpSimple };


