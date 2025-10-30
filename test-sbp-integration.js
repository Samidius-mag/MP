#!/usr/bin/env node

/**
 * Скрипт для тестирования СБП интеграции
 * Запуск: node test-sbp-integration.js
 */

const axios = require('axios');

// Конфигурация
const config = {
  serverUrl: process.env.SERVER_URL || 'http://localhost:5000',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  testAmount: 1000, // 10 ₽ в копейках
  testEmail: 'test@example.com',
  testPassword: 'testpassword123'
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

async function testSbpIntegration() {
  log('\n🧪 Тестирование СБП интеграции', 'bold');
  log('================================', 'blue');

  try {
    // 1. Проверка доступности сервера
    log('\n1. Проверка доступности сервера...', 'yellow');
    try {
      const healthResponse = await axios.get(`${config.serverUrl}/api/health`);
      log('✅ Сервер доступен', 'green');
    } catch (error) {
      log('❌ Сервер недоступен', 'red');
      log(`Ошибка: ${error.message}`, 'red');
      return;
    }

    // 2. Регистрация тестового пользователя
    log('\n2. Регистрация тестового пользователя...', 'yellow');
    let authToken;
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
      
      log(`Отправляем данные: ${JSON.stringify(registerData, null, 2)}`, 'blue');
      
      const registerResponse = await axios.post(`${config.serverUrl}/api/auth/register`, registerData);
      
      authToken = registerResponse.data.token;
      log('✅ Пользователь зарегистрирован', 'green');
    } catch (error) {
      log('❌ Ошибка регистрации', 'red');
      if (error.response?.data) {
        log(`Детали ошибки: ${JSON.stringify(error.response.data, null, 2)}`, 'red');
      } else {
        log(`Ошибка: ${error.message}`, 'red');
      }
      
      if (error.response?.status === 409) {
        // Пользователь уже существует, попробуем войти
        log('\n⚠️  Пользователь уже существует, выполняем вход...', 'yellow');
        try {
          const loginResponse = await axios.post(`${config.serverUrl}/api/auth/login`, {
            email: config.testEmail,
            password: config.testPassword
          });
          authToken = loginResponse.data.token;
          log('✅ Вход выполнен', 'green');
        } catch (loginError) {
          log('❌ Ошибка входа', 'red');
          if (loginError.response?.data) {
            log(`Детали ошибки входа: ${JSON.stringify(loginError.response.data, null, 2)}`, 'red');
          } else {
            log(`Ошибка входа: ${loginError.message}`, 'red');
          }
          return;
        }
      } else {
        log('\n💡 Возможные причины ошибки 400:', 'yellow');
        log('   - Неправильные имена полей (first_name вместо firstName)', 'yellow');
        log('   - Недостаточная длина пароля', 'yellow');
        log('   - Неправильный формат email', 'yellow');
        log('   - Проблемы с валидацией на сервере', 'yellow');
        return;
      }
    }

    // 3. Создание СБП платежа
    log('\n3. Создание СБП платежа...', 'yellow');
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

        // 4. Проверка статуса платежа
        log('\n4. Проверка статуса платежа...', 'yellow');
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

        // 5. Получение списка депозитов
        log('\n5. Получение списка депозитов...', 'yellow');
        try {
          const depositsResponse = await axios.get(`${config.serverUrl}/api/payment/deposits`, {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          });

          const deposits = depositsResponse.data.deposits;
          log('✅ Список депозитов получен', 'green');
          log(`   Количество депозитов: ${deposits.length}`, 'blue');
          
          if (deposits.length > 0) {
            const latestDeposit = deposits[0];
            log(`   Последний депозит:`, 'blue');
            log(`     ID: ${latestDeposit.id}`, 'blue');
            log(`     Сумма: ${latestDeposit.amount} ₽`, 'blue');
            log(`     Статус: ${latestDeposit.status}`, 'blue');
            log(`     Метод: ${latestDeposit.payment_method}`, 'blue');
          }
        } catch (depositsError) {
          log('⚠️  Ошибка получения депозитов', 'yellow');
          log(`Ошибка: ${depositsError.response?.data?.error || depositsError.message}`, 'yellow');
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

    // 6. Тест webhook (симуляция)
    log('\n6. Тест webhook (симуляция)...', 'yellow');
    try {
      const webhookData = {
        orderId: 'test-order-' + Date.now(),
        status: '1',
        amount: config.testAmount,
        operation: 'deposited'
      };

      const webhookResponse = await axios.post(`${config.serverUrl}/api/payment/sbp-webhook`, webhookData, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (webhookResponse.data.status === 'ok') {
        log('✅ Webhook обработан', 'green');
      } else {
        log('⚠️  Webhook обработан с предупреждением', 'yellow');
      }
    } catch (webhookError) {
      log('⚠️  Ошибка webhook', 'yellow');
      log(`Ошибка: ${webhookError.response?.data?.error || webhookError.message}`, 'yellow');
    }

    log('\n🎉 Тестирование завершено!', 'bold');
    log('================================', 'blue');
    
    log('\n📋 Следующие шаги:', 'yellow');
    log('1. Настройте переменные окружения в .env', 'blue');
    log('2. Получите реальные данные от ВТБ', 'blue');
    log('3. Протестируйте с реальными платежами', 'blue');
    log('4. Настройте webhook URL в личном кабинете ВТБ', 'blue');

  } catch (error) {
    log('\n❌ Критическая ошибка тестирования', 'red');
    log(`Ошибка: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Запуск тестирования
if (require.main === module) {
  testSbpIntegration().catch(console.error);
}

module.exports = { testSbpIntegration };
