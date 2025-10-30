const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { requireClient } = require('../middleware/auth');
const pdfGenerator = require('../services/pdfGenerator');
const vtbSbpService = require('../services/vtbSbpService');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '..', 'uploads', 'payment-orders');
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `payment-order-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Недопустимый тип файла. Разрешены только PDF, JPEG, PNG файлы.'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// Создание платежа для пополнения депозита
router.post('/deposit', requireClient, [
  body('amount').isFloat({ min: 1 }),
  body('payment_method').isIn(['sbp', 'bank_transfer', 'yukassa', 'tinkoff'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, payment_method } = req.body;

    const client = await pool.connect();
    try {
      // Получаем ID клиента
      const clientResult = await client.query(
        'SELECT id FROM clients WHERE user_id = $1',
        [req.user.id]
      );

      if (clientResult.rows.length === 0) {
        return res.status(404).json({ error: 'Client not found' });
      }

      const clientId = clientResult.rows[0].id;

      // Получаем текущий баланс
      const balanceResult = await client.query(
        `SELECT balance_after 
         FROM deposits 
         WHERE client_id = $1
         ORDER BY created_at DESC 
         LIMIT 1`,
        [clientId]
      );

      const currentBalance = balanceResult.rows.length > 0 
        ? parseFloat(balanceResult.rows[0].balance_after) 
        : 0;

      // Генерируем уникальный ID платежа и номер счета
      const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const invoiceNumber = `INV-${Date.now()}`;

      // Получаем информацию о клиенте для счета
      const clientInfoResult = await client.query(
        'SELECT company_name, inn, address FROM clients WHERE id = $1',
        [clientId]
      );

      const clientInfo = clientInfoResult.rows[0];

      // Генерируем PDF счет
      let invoiceData = null;
      if (payment_method === 'bank_transfer') {
        invoiceData = await pdfGenerator.generateInvoice({
          invoiceNumber,
          clientName: clientInfo.company_name || 'Не указано',
          clientInn: clientInfo.inn || 'Не указан',
          clientAddress: clientInfo.address || 'Не указан',
          amount: parseFloat(amount),
          purpose: `Пополнение депозита. ID: ${paymentId}`,
          bankAccount: '40702810100000000000',
          bankName: 'ПАО "Сбербанк"',
          bankBik: '044525225',
          bankCorrAccount: '30101810400000000225',
          createdAt: new Date().toLocaleDateString('ru-RU')
        });
      }

      // Создаем запись о платеже
      const depositResult = await client.query(
        `INSERT INTO deposits (client_id, amount, balance_before, balance_after, transaction_type, description, payment_method, payment_id, status, invoice_number, invoice_file_path)
         VALUES ($1, $2, $3, $4, 'deposit', $5, $6, $7, 'pending', $8, $9)
         RETURNING id`,
        [
          clientId,
          amount,
          currentBalance,
          currentBalance, // Баланс пока не изменится
          `Пополнение депозита на ${amount} ₽`,
          payment_method,
          paymentId,
          invoiceNumber,
          invoiceData ? invoiceData.relativePath : null
        ]
      );

      const depositId = depositResult.rows[0].id;

      // В зависимости от метода платежа, создаем ссылку для оплаты
      let paymentUrl = null;
      
      switch (payment_method) {
        case 'sbp':
          paymentUrl = await createSBPPayment(paymentId, amount, depositId);
          break;
        case 'yukassa':
          paymentUrl = await createYukassaPayment(paymentId, amount);
          break;
        case 'tinkoff':
          paymentUrl = await createTinkoffPayment(paymentId, amount);
          break;
        case 'bank_transfer':
          // Для банковского перевода возвращаем реквизиты
          paymentUrl = {
            type: 'bank_transfer',
            details: {
              account: '40702810100000000000',
              bank: 'ПАО "Сбербанк"',
              bik: '044525225',
              purpose: `Пополнение депозита. ID: ${paymentId}`
            }
          };
          break;
      }

      res.json({
        message: 'Payment created successfully',
        paymentId,
        amount,
        paymentUrl,
        depositId,
        invoiceNumber,
        invoiceFile: invoiceData ? invoiceData.relativePath : null
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Deposit payment error:', err);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

// Webhook для СБП платежей ВТБ
router.post('/sbp-webhook', async (req, res) => {
  try {
    const webhookData = req.body;
    console.log('SBP Webhook received:', webhookData);

    // Проверяем подпись уведомления
    const signature = req.headers['x-signature'] || req.body.checksum;
    if (!vtbSbpService.verifyNotificationSignature(webhookData, signature)) {
      console.error('Invalid SBP webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const client = await pool.connect();
    try {
      const { orderId, status, amount, operation } = webhookData;

      if (!orderId) {
        return res.status(400).json({ error: 'Order ID not found' });
      }

      // Находим депозит по orderId (используем payment_id)
      const depositResult = await client.query(
        'SELECT * FROM deposits WHERE payment_id = $1',
        [orderId]
      );

      if (depositResult.rows.length === 0) {
        console.error('Deposit not found for orderId:', orderId);
        return res.status(404).json({ error: 'Deposit not found' });
      }

      const deposit = depositResult.rows[0];

      // Обрабатываем статус платежа
      if (status === '1' && operation === 'deposited' && deposit.status === 'pending') {
        const newBalance = deposit.balance_before + deposit.amount;
        
        await client.query(
          'UPDATE deposits SET status = $1, balance_after = $2, bank_verification_status = $3, bank_verification_date = CURRENT_TIMESTAMP WHERE id = $3',
          ['completed', newBalance, 'verified', deposit.id]
        );

        // Отправляем уведомление клиенту
        await client.query(
          `INSERT INTO notifications (user_id, type, title, message)
           SELECT c.user_id, 'internal', 'Депозит пополнен', 
                  'Ваш депозит пополнен на ${deposit.amount} ₽ через СБП. Новый баланс: ${newBalance} ₽'
           FROM clients c WHERE c.id = $1`,
          [deposit.client_id]
        );

        console.log(`SBP payment completed for deposit ${deposit.id}, new balance: ${newBalance}`);
      } else if (status === '2' || status === '3') {
        // Платеж отклонен или отменен
        await client.query(
          'UPDATE deposits SET status = $1, bank_verification_status = $2 WHERE id = $3',
          ['failed', 'rejected', deposit.id]
        );

        console.log(`SBP payment failed for deposit ${deposit.id}, status: ${status}`);
      }

      res.json({ status: 'ok' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('SBP webhook processing error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Обработка уведомлений от платежных систем
router.post('/webhook/:payment_method', async (req, res) => {
  try {
    const { payment_method } = req.params;
    const webhookData = req.body;

    const client = await pool.connect();
    try {
      let paymentId = null;
      let status = null;
      let amount = null;

      // Обрабатываем уведомления в зависимости от платежной системы
      switch (payment_method) {
        case 'yukassa':
          ({ paymentId, status, amount } = await processYukassaWebhook(webhookData));
          break;
        case 'tinkoff':
          ({ paymentId, status, amount } = await processTinkoffWebhook(webhookData));
          break;
        case 'sbp':
          ({ paymentId, status, amount } = await processSBPWebhook(webhookData));
          break;
        default:
          return res.status(400).json({ error: 'Unsupported payment method' });
      }

      if (!paymentId) {
        return res.status(400).json({ error: 'Payment ID not found' });
      }

      // Находим депозит по payment_id
      const depositResult = await client.query(
        'SELECT * FROM deposits WHERE payment_id = $1',
        [paymentId]
      );

      if (depositResult.rows.length === 0) {
        return res.status(404).json({ error: 'Deposit not found' });
      }

      const deposit = depositResult.rows[0];

      // Обновляем статус депозита
      if (status === 'succeeded' && deposit.status === 'pending') {
        const newBalance = deposit.balance_before + deposit.amount;
        
        await client.query(
          'UPDATE deposits SET status = $1, balance_after = $2 WHERE id = $3',
          ['completed', newBalance, deposit.id]
        );

        // Отправляем уведомление клиенту
        await client.query(
          `INSERT INTO notifications (user_id, type, title, message)
           SELECT c.user_id, 'internal', 'Депозит пополнен', 
                  'Ваш депозит пополнен на ${deposit.amount} ₽. Новый баланс: ${newBalance} ₽'
           FROM clients c WHERE c.id = $1`,
          [deposit.client_id]
        );
      } else if (status === 'failed') {
        await client.query(
          'UPDATE deposits SET status = $1 WHERE id = $2',
          ['failed', deposit.id]
        );
      }

      res.json({ status: 'ok' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Получение статуса платежа
router.get('/status/:paymentId', requireClient, async (req, res) => {
  try {
    const { paymentId } = req.params;

    const client = await pool.connect();
    try {
      const depositResult = await client.query(
        `SELECT d.*, c.user_id
         FROM deposits d
         JOIN clients c ON d.client_id = c.id
         WHERE d.payment_id = $1 AND c.user_id = $2`,
        [paymentId, req.user.id]
      );

      if (depositResult.rows.length === 0) {
        return res.status(404).json({ error: 'Payment not found' });
      }

      const deposit = depositResult.rows[0];
      res.json({
        paymentId: deposit.payment_id,
        amount: deposit.amount,
        status: deposit.status,
        createdAt: deposit.created_at
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Payment status error:', err);
    res.status(500).json({ error: 'Failed to get payment status' });
  }
});

// Вспомогательные функции для создания платежей
async function createSBPPayment(paymentId, amount, depositId) {
  try {
    const baseUrl = process.env.CLIENT_BASE_URL || 'http://localhost:3000';
    
    const paymentData = {
      orderNumber: paymentId,
      amount: Math.round(amount * 100), // Конвертируем в копейки
      description: `Пополнение депозита на ${amount} ₽`,
      returnUrl: `${baseUrl}/client/deposit?success=true&depositId=${depositId}`,
      failUrl: `${baseUrl}/client/deposit?error=true&depositId=${depositId}`,
      notificationUrl: `${process.env.SERVER_BASE_URL || 'http://localhost:5000'}/api/payment/sbp-webhook`
    };

    const result = await vtbSbpService.createSbpPayment(paymentData);
    
    if (result.success) {
      return {
        type: 'sbp',
        orderId: result.orderId,
        qrCode: result.qrCode,
        qrCodeUrl: result.qrCodeUrl,
        paymentUrl: result.paymentUrl,
        amount: amount
      };
    } else {
      throw new Error(result.error || 'Ошибка создания СБП платежа');
    }
  } catch (error) {
    console.error('SBP payment creation error:', error);
    return {
      type: 'sbp',
      error: error.message
    };
  }
}

async function createYukassaPayment(paymentId, amount) {
  // Здесь должна быть интеграция с ЮKassa
  // Пока возвращаем заглушку
  return {
    type: 'yukassa',
    url: `https://yoomoney.ru/checkout/payments/v2/payment?orderId=${paymentId}`,
    confirmationUrl: `https://yoomoney.ru/checkout/payments/v2/confirmation?orderId=${paymentId}`
  };
}

async function createTinkoffPayment(paymentId, amount) {
  // Здесь должна быть интеграция с Тинькофф
  // Пока возвращаем заглушку
  return {
    type: 'tinkoff',
    url: `https://securepay.tinkoff.ru/v2/Charge?PaymentId=${paymentId}`,
    paymentFormUrl: `https://securepay.tinkoff.ru/v2/Charge?PaymentId=${paymentId}`
  };
}

// Вспомогательные функции для обработки webhook'ов
async function processYukassaWebhook(data) {
  // Обработка webhook от ЮKassa
  return {
    paymentId: data.object?.id,
    status: data.object?.status === 'succeeded' ? 'succeeded' : 'failed',
    amount: data.object?.amount?.value
  };
}

async function processTinkoffWebhook(data) {
  // Обработка webhook от Тинькофф
  return {
    paymentId: data.PaymentId,
    status: data.Status === 'CONFIRMED' ? 'succeeded' : 'failed',
    amount: data.Amount
  };
}

async function processSBPWebhook(data) {
  // Обработка webhook от СБП
  return {
    paymentId: data.payment_id,
    status: data.status === 'success' ? 'succeeded' : 'failed',
    amount: data.amount
  };
}

// Загрузка платежного поручения
router.post('/upload-payment-order/:depositId', requireClient, upload.single('paymentOrder'), async (req, res) => {
  try {
    const { depositId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'Файл платежного поручения не загружен' });
    }

    const client = await pool.connect();
    try {
      // Проверяем, что депозит принадлежит клиенту
      const depositResult = await client.query(
        `SELECT d.*, c.user_id 
         FROM deposits d 
         JOIN clients c ON d.client_id = c.id 
         WHERE d.id = $1 AND c.user_id = $2`,
        [depositId, req.user.id]
      );

      if (depositResult.rows.length === 0) {
        return res.status(404).json({ error: 'Депозит не найден' });
      }

      const deposit = depositResult.rows[0];

      // Обновляем запись депозита с путем к файлу
      await client.query(
        'UPDATE deposits SET payment_order_file_path = $1 WHERE id = $2',
        [req.file.path, depositId]
      );

      // Создаем запись в таблице платежных поручений
      await client.query(
        `INSERT INTO payment_orders (client_id, deposit_id, amount, bank_account, bank_name, bank_bik, purpose, payment_order_file_path)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          deposit.client_id,
          depositId,
          deposit.amount,
          '40702810100000000000',
          'ПАО "Сбербанк"',
          '044525225',
          `Пополнение депозита. ID: ${deposit.payment_id}`,
          req.file.path
        ]
      );

      res.json({
        message: 'Платежное поручение загружено успешно',
        filePath: req.file.path
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Upload payment order error:', err);
    res.status(500).json({ error: 'Ошибка загрузки платежного поручения' });
  }
});

// Скачивание PDF счета
router.get('/download-invoice/:depositId', requireClient, async (req, res) => {
  try {
    const { depositId } = req.params;

    const client = await pool.connect();
    try {
      // Проверяем, что депозит принадлежит клиенту
      const depositResult = await client.query(
        `SELECT d.*, c.user_id 
         FROM deposits d 
         JOIN clients c ON d.client_id = c.id 
         WHERE d.id = $1 AND c.user_id = $2`,
        [depositId, req.user.id]
      );

      if (depositResult.rows.length === 0) {
        return res.status(404).json({ error: 'Депозит не найден' });
      }

      const deposit = depositResult.rows[0];

      if (!deposit.invoice_file_path) {
        return res.status(404).json({ error: 'PDF счет не найден' });
      }

      const filePath = path.join(__dirname, '..', deposit.invoice_file_path);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Файл счета не найден на сервере' });
      }

      res.download(filePath, `invoice_${deposit.invoice_number}.pdf`);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Download invoice error:', err);
    res.status(500).json({ error: 'Ошибка скачивания счета' });
  }
});

// Проверка статуса СБП платежа
router.get('/sbp-status/:orderId', requireClient, async (req, res) => {
  try {
    const { orderId } = req.params;

    const client = await pool.connect();
    try {
      // Проверяем, что депозит принадлежит клиенту
      const depositResult = await client.query(
        `SELECT d.*, c.user_id 
         FROM deposits d 
         JOIN clients c ON d.client_id = c.id 
         WHERE d.payment_id = $1 AND c.user_id = $2`,
        [orderId, req.user.id]
      );

      if (depositResult.rows.length === 0) {
        return res.status(404).json({ error: 'Депозит не найден' });
      }

      const deposit = depositResult.rows[0];

      // Проверяем статус в ВТБ
      const statusResult = await vtbSbpService.checkPaymentStatus(orderId);
      
      if (statusResult.success) {
        res.json({
          orderId: statusResult.orderId,
          status: statusResult.status,
          amount: statusResult.amount,
          operation: statusResult.operation,
          localStatus: deposit.status,
          balance: deposit.balance_after
        });
      } else {
        res.status(400).json({ 
          error: statusResult.error,
          localStatus: deposit.status,
          balance: deposit.balance_after
        });
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('SBP status check error:', error);
    res.status(500).json({ error: 'Ошибка проверки статуса СБП платежа' });
  }
});

// Получение списка депозитов с информацией о счетах
router.get('/deposits', requireClient, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      // Получаем ID клиента
      const clientResult = await client.query(
        'SELECT id FROM clients WHERE user_id = $1',
        [req.user.id]
      );

      if (clientResult.rows.length === 0) {
        return res.status(404).json({ error: 'Client not found' });
      }

      const clientId = clientResult.rows[0].id;

      // Получаем депозиты с информацией о счетах
      const depositsResult = await client.query(
        `SELECT id, amount, balance_before, balance_after, transaction_type, 
                description, payment_method, payment_id, status, 
                invoice_number, invoice_file_path, payment_order_file_path,
                bank_verification_status, created_at
         FROM deposits 
         WHERE client_id = $1 
         ORDER BY created_at DESC 
         LIMIT 50`,
        [clientId]
      );

      res.json({
        deposits: depositsResult.rows
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get deposits error:', err);
    res.status(500).json({ error: 'Ошибка получения списка депозитов' });
  }
});

module.exports = router;



