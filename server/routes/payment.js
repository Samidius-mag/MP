const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { requireClient } = require('../middleware/auth');

const router = express.Router();

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

      // Генерируем уникальный ID платежа
      const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Создаем запись о платеже
      const depositResult = await client.query(
        `INSERT INTO deposits (client_id, amount, balance_before, balance_after, transaction_type, description, payment_method, payment_id, status)
         VALUES ($1, $2, $3, $4, 'deposit', $5, $6, $7, 'pending')
         RETURNING id`,
        [
          clientId,
          amount,
          currentBalance,
          currentBalance, // Баланс пока не изменится
          `Пополнение депозита на ${amount} ₽`,
          payment_method,
          paymentId
        ]
      );

      const depositId = depositResult.rows[0].id;

      // В зависимости от метода платежа, создаем ссылку для оплаты
      let paymentUrl = null;
      
      switch (payment_method) {
        case 'sbp':
          paymentUrl = await createSBPPayment(paymentId, amount);
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
        depositId
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Deposit payment error:', err);
    res.status(500).json({ error: 'Failed to create payment' });
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
async function createSBPPayment(paymentId, amount) {
  // Здесь должна быть интеграция с СБП
  // Пока возвращаем заглушку
  return {
    type: 'sbp',
    url: `https://sbp.example.com/pay/${paymentId}`,
    qr: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${paymentId}`
  };
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

module.exports = router;



