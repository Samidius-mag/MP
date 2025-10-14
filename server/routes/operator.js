const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { pool } = require('../config/database');
const { requireOperator } = require('../middleware/auth');

const router = express.Router();

// Получение заказов для сборки
router.get('/orders', requireOperator, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['new', 'in_assembly', 'ready_to_ship', 'shipped', 'delivered', 'cancelled']),
  query('client_id').optional().isInt({ min: 1 }),
  query('marketplace').optional().isIn(['wildberries', 'ozon', 'yandex_market']),
  query('search').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { status, client_id, marketplace, search } = req.query;

    const client = await pool.connect();
    try {
      let whereClause = 'WHERE 1=1';
      let queryParams = [];
      let paramIndex = 1;

      if (status) {
        whereClause += ` AND o.status = $${paramIndex}`;
        queryParams.push(status);
        paramIndex++;
      }

      if (client_id) {
        whereClause += ` AND o.client_id = $${paramIndex}`;
        queryParams.push(client_id);
        paramIndex++;
      }

      if (marketplace) {
        whereClause += ` AND o.marketplace = $${paramIndex}`;
        queryParams.push(marketplace);
        paramIndex++;
      }

      if (search) {
        whereClause += ` AND (o.customer_name ILIKE $${paramIndex} OR o.marketplace_order_id ILIKE $${paramIndex} OR c.company_name ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      // Получаем заказы
      const ordersResult = await client.query(
        `SELECT o.*, c.company_name, c.user_id as client_user_id
         FROM orders o
         JOIN clients c ON o.client_id = c.id
         ${whereClause}
         ORDER BY o.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...queryParams, limit, offset]
      );

      // Получаем товары для каждого заказа
      for (let order of ordersResult.rows) {
        const itemsResult = await client.query(
          'SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at',
          [order.id]
        );
        order.items = itemsResult.rows;
      }

      // Получаем общее количество
      const countResult = await client.query(
        `SELECT COUNT(*) as total
         FROM orders o
         JOIN clients c ON o.client_id = c.id
         ${whereClause}`,
        queryParams
      );

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      res.json({
        orders: ordersResult.rows,
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
    console.error('Operator orders error:', err);
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

// Обновление статуса заказа
router.put('/orders/:orderId/status', requireOperator, [
  body('status').isIn(['new', 'in_assembly', 'ready_to_ship', 'shipped', 'delivered', 'cancelled']),
  body('tracking_number').optional().trim(),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orderId } = req.params;
    const { status, tracking_number, notes } = req.body;

    const client = await pool.connect();
    try {
      // Проверяем, существует ли заказ
      const orderResult = await client.query(
        'SELECT * FROM orders WHERE id = $1',
        [orderId]
      );

      if (orderResult.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
      }

      // Обновляем статус заказа
      await client.query(
        `UPDATE orders 
         SET status = $1, 
             tracking_number = COALESCE($2, tracking_number),
             notes = COALESCE($3, notes),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [status, tracking_number, notes, orderId]
      );

      // Если заказ передан в доставку, списываем средства с депозита клиента
      if (status === 'shipped') {
        const order = orderResult.rows[0];
        
        // Получаем текущий баланс клиента
        const balanceResult = await client.query(
          `SELECT balance_after 
           FROM deposits 
           WHERE client_id = $1
           ORDER BY created_at DESC 
           LIMIT 1`,
          [order.client_id]
        );

        const currentBalance = balanceResult.rows.length > 0 
          ? parseFloat(balanceResult.rows[0].balance_after) 
          : 0;

        const newBalance = currentBalance - order.total_amount;

        // Создаем запись о списании
        await client.query(
          `INSERT INTO deposits (client_id, amount, balance_before, balance_after, transaction_type, description)
           VALUES ($1, $2, $3, $4, 'order_payment', $5)`,
          [
            order.client_id,
            -order.total_amount,
            currentBalance,
            newBalance,
            `Оплата заказа #${order.marketplace_order_id}`
          ]
        );
      }

      res.json({ message: 'Order status updated successfully' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Order status update error:', err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// Создание стикера для заказа
router.post('/orders/:orderId/sticker', requireOperator, async (req, res) => {
  try {
    const { orderId } = req.params;

    const client = await pool.connect();
    try {
      // Получаем заказ с товарами
      const orderResult = await client.query(
        `SELECT o.*, c.company_name, c.user_id as client_user_id
         FROM orders o
         JOIN clients c ON o.client_id = c.id
         WHERE o.id = $1`,
        [orderId]
      );

      if (orderResult.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
      }

      const order = orderResult.rows[0];

      // Получаем товары заказа
      const itemsResult = await client.query(
        'SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at',
        [orderId]
      );

      // Создаем данные стикера
      const stickerData = {
        orderId: order.id,
        marketplaceOrderId: order.marketplace_order_id,
        clientName: order.company_name,
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        deliveryAddress: order.delivery_address,
        trackingNumber: order.tracking_number,
        items: itemsResult.rows,
        createdAt: new Date().toISOString()
      };

      // Сохраняем стикер в базу
      const stickerResult = await client.query(
        'INSERT INTO stickers (order_id, sticker_data) VALUES ($1, $2) RETURNING id',
        [orderId, JSON.stringify(stickerData)]
      );

      const stickerId = stickerResult.rows[0].id;

      res.json({
        message: 'Sticker created successfully',
        stickerId,
        stickerData
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Sticker creation error:', err);
    res.status(500).json({ error: 'Failed to create sticker' });
  }
});

// Получение стикера
router.get('/stickers/:stickerId', requireOperator, async (req, res) => {
  try {
    const { stickerId } = req.params;

    const client = await pool.connect();
    try {
      const stickerResult = await client.query(
        'SELECT * FROM stickers WHERE id = $1',
        [stickerId]
      );

      if (stickerResult.rows.length === 0) {
        return res.status(404).json({ error: 'Sticker not found' });
      }

      const sticker = stickerResult.rows[0];
      res.json(sticker);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Sticker retrieval error:', err);
    res.status(500).json({ error: 'Failed to get sticker' });
  }
});

// Отметка стикера как напечатанного
router.put('/stickers/:stickerId/print', requireOperator, async (req, res) => {
  try {
    const { stickerId } = req.params;

    const client = await pool.connect();
    try {
      await client.query(
        'UPDATE stickers SET printed_at = CURRENT_TIMESTAMP WHERE id = $1',
        [stickerId]
      );

      res.json({ message: 'Sticker marked as printed' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Sticker print error:', err);
    res.status(500).json({ error: 'Failed to mark sticker as printed' });
  }
});

// Получение списка клиентов для фильтрации
router.get('/clients', requireOperator, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const clientsResult = await client.query(
        `SELECT c.id, c.company_name, u.first_name, u.last_name, u.email
         FROM clients c
         JOIN users u ON c.user_id = u.id
         ORDER BY c.company_name`
      );

      res.json(clientsResult.rows);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Clients list error:', err);
    res.status(500).json({ error: 'Failed to get clients list' });
  }
});

// Получение статистики для оператора
router.get('/stats', requireOperator, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      // Общее количество заказов
      const totalOrdersResult = await client.query(
        'SELECT COUNT(*) as total FROM orders'
      );

      // Заказы по статусам
      const ordersByStatusResult = await client.query(
        'SELECT status, COUNT(*) as count FROM orders GROUP BY status'
      );

      // Заказы за сегодня
      const todayOrdersResult = await client.query(
        `SELECT COUNT(*) as count
         FROM orders
         WHERE DATE(created_at) = CURRENT_DATE`
      );

      // Заказы за последние 7 дней
      const weekOrdersResult = await client.query(
        `SELECT COUNT(*) as count
         FROM orders
         WHERE created_at >= NOW() - INTERVAL '7 days'`
      );

      // Заказы, требующие внимания (новые и в сборке)
      const pendingOrdersResult = await client.query(
        `SELECT COUNT(*) as count
         FROM orders
         WHERE status IN ('new', 'in_assembly')`
      );

      res.json({
        totalOrders: parseInt(totalOrdersResult.rows[0].total),
        ordersByStatus: ordersByStatusResult.rows.reduce((acc, row) => {
          acc[row.status] = parseInt(row.count);
          return acc;
        }, {}),
        todayOrders: parseInt(todayOrdersResult.rows[0].count),
        weekOrders: parseInt(weekOrdersResult.rows[0].count),
        pendingOrders: parseInt(pendingOrdersResult.rows[0].count)
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Operator stats error:', err);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

module.exports = router;



