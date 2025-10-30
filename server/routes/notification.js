const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { pool } = require('../config/database');
const nodemailer = require('nodemailer');

const router = express.Router();

// Получение уведомлений пользователя
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const unreadOnly = req.query.unread_only === 'true';

    const client = await pool.connect();
    try {
      let whereClause = 'WHERE user_id = $1';
      let queryParams = [req.user.id];
      let paramIndex = 2;

      if (unreadOnly) {
        whereClause += ` AND is_read = false`;
      }

      // Получаем уведомления
      const notificationsResult = await client.query(
        `SELECT * FROM notifications
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...queryParams, limit, offset]
      );

      // Получаем общее количество
      const countResult = await client.query(
        `SELECT COUNT(*) as total
         FROM notifications
         ${whereClause}`,
        queryParams
      );

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      res.json({
        notifications: notificationsResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Notifications error:', err);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// Отметка уведомления как прочитанного
router.put('/:notificationId/read', async (req, res) => {
  try {
    const { notificationId } = req.params;

    const client = await pool.connect();
    try {
      await client.query(
        'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
        [notificationId, req.user.id]
      );

      res.json({ message: 'Notification marked as read' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Mark notification as read error:', err);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Отметка всех уведомлений как прочитанных
router.put('/mark-all-read', async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      await client.query(
        'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
        [req.user.id]
      );

      res.json({ message: 'All notifications marked as read' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Mark all notifications as read error:', err);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// Отправка уведомления
router.post('/send', [
  body('user_id').isInt({ min: 1 }),
  body('type').isIn(['email', 'sms', 'internal']),
  body('title').notEmpty().trim(),
  body('message').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { user_id, type, title, message } = req.body;

    const client = await pool.connect();
    try {
      // Создаем уведомление в базе
      const notificationResult = await client.query(
        `INSERT INTO notifications (user_id, type, title, message, sent_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [user_id, type, title, message, new Date()]
      );

      const notificationId = notificationResult.rows[0].id;

      // Отправляем уведомление в зависимости от типа
      let sent = false;
      switch (type) {
        case 'email':
          sent = await sendEmailNotification(user_id, title, message);
          break;
        case 'sms':
          sent = await sendSMSNotification(user_id, title, message);
          break;
        case 'internal':
          sent = true; // Внутренние уведомления уже сохранены в базе
          break;
      }

      // Обновляем статус отправки
      if (sent) {
        await client.query(
          'UPDATE notifications SET sent_at = CURRENT_TIMESTAMP WHERE id = $1',
          [notificationId]
        );
      }

      res.json({
        message: 'Notification sent successfully',
        notificationId,
        sent
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Send notification error:', err);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// Получение количества непрочитанных уведомлений
router.get('/unread-count', async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const countResult = await client.query(
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
        [req.user.id]
      );

      res.json({ count: parseInt(countResult.rows[0].count) });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Unread count error:', err);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// Вспомогательные функции для отправки уведомлений
async function sendEmailNotification(userId, title, message) {
  try {
    const client = await pool.connect();
    try {
      // Получаем email пользователя
      const userResult = await client.query(
        'SELECT email, first_name, last_name FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return false;
      }

      const user = userResult.rows[0];

      // Настраиваем SMTP
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      // Отправляем email
      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: user.email,
        subject: title,
        html: `
          <h2>${title}</h2>
          <p>Здравствуйте, ${user.first_name} ${user.last_name}!</p>
          <p>${message}</p>
          <hr>
          <p><small>Это автоматическое уведомление от системы дропшиппинга.</small></p>
        `
      });

      return true;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Email notification error:', err);
    return false;
  }
}

async function sendSMSNotification(userId, title, message) {
  try {
    const client = await pool.connect();
    try {
      // Получаем телефон пользователя
      const userResult = await client.query(
        'SELECT phone FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0 || !userResult.rows[0].phone) {
        return false;
      }

      const phone = userResult.rows[0].phone;

      // Здесь должна быть интеграция с SMS-сервисом
      // Пока возвращаем заглушку
      console.log(`SMS to ${phone}: ${title} - ${message}`);
      
      return true;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('SMS notification error:', err);
    return false;
  }
}

// Функция для отправки уведомления о низком балансе
async function sendLowBalanceNotification(clientId, currentBalance, threshold = 5000) {
  try {
    const client = await pool.connect();
    try {
      // Получаем данные клиента
      const clientResult = await client.query(
        `SELECT c.user_id, u.first_name, u.last_name, u.email
         FROM clients c
         JOIN users u ON c.user_id = u.id
         WHERE c.id = $1`,
        [clientId]
      );

      if (clientResult.rows.length === 0) {
        return;
      }

      const clientData = clientResult.rows[0];

      // Создаем уведомление
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, sent_at)
         VALUES ($1, 'internal', 'Низкий баланс депозита', 
                'Ваш баланс составляет ${currentBalance} ₽. Рекомендуем пополнить депозит для продолжения обработки заказов.', 
                CURRENT_TIMESTAMP)`,
        [clientData.user_id]
      );

      // Отправляем email
      await sendEmailNotification(
        clientData.user_id,
        'Низкий баланс депозита',
        `Ваш баланс составляет ${currentBalance} ₽. Рекомендуем пополнить депозит для продолжения обработки заказов.`
      );
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Low balance notification error:', err);
  }
}

// Функция для отправки уведомления о новом заказе
async function sendNewOrderNotification(clientId, orderData) {
  try {
    const client = await pool.connect();
    try {
      // Получаем данные клиента
      const clientResult = await client.query(
        `SELECT c.user_id, u.first_name, u.last_name, u.email
         FROM clients c
         JOIN users u ON c.user_id = u.id
         WHERE c.id = $1`,
        [clientId]
      );

      if (clientResult.rows.length === 0) {
        return;
      }

      const clientData = clientResult.rows[0];

      // Создаем уведомление
      const totalAmountRubles = (orderData.total_amount / 100).toFixed(2);
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, sent_at)
         VALUES ($1, 'internal', 'Новый заказ', 
                'Поступил новый заказ #${orderData.marketplace_order_id} с ${orderData.marketplace} на сумму ${totalAmountRubles} ₽.', 
                CURRENT_TIMESTAMP)`,
        [clientData.user_id]
      );

      // Отправляем email
      await sendEmailNotification(
        clientData.user_id,
        'Новый заказ',
        `Поступил новый заказ #${orderData.marketplace_order_id} с ${orderData.marketplace} на сумму ${totalAmountRubles} ₽.`
      );
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('New order notification error:', err);
  }
}

module.exports = {
  router,
  sendLowBalanceNotification,
  sendNewOrderNotification
};



