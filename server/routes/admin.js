const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { pool } = require('../config/database');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Получение списка всех пользователей
router.get('/users', requireAdmin, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('role').optional().isIn(['client', 'operator', 'admin']),
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
    const { role, search } = req.query;

    const client = await pool.connect();
    try {
      let whereClause = 'WHERE 1=1';
      let queryParams = [];
      let paramIndex = 1;

      if (role) {
        whereClause += ` AND u.role = $${paramIndex}`;
        queryParams.push(role);
        paramIndex++;
      }

      if (search) {
        whereClause += ` AND (u.email ILIKE $${paramIndex} OR u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex} OR c.company_name ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      // Получаем пользователей
      const usersResult = await client.query(
        `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.role, u.is_active, u.created_at,
                c.company_name, c.inn, c.address
         FROM users u
         LEFT JOIN clients c ON u.id = c.user_id
         ${whereClause}
         ORDER BY u.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...queryParams, limit, offset]
      );

      // Получаем общее количество
      const countResult = await client.query(
        `SELECT COUNT(*) as total
         FROM users u
         LEFT JOIN clients c ON u.id = c.user_id
         ${whereClause}`,
        queryParams
      );

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      res.json({
        users: usersResult.rows,
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
    console.error('Admin users error:', err);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Получение детальной информации о пользователе
router.get('/users/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    const client = await pool.connect();
    try {
      // Получаем данные пользователя
      const userResult = await client.query(
        `SELECT u.*, c.company_name, c.inn, c.address, c.api_keys
         FROM users u
         LEFT JOIN clients c ON u.id = c.user_id
         WHERE u.id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = userResult.rows[0];

      // Получаем статистику пользователя
      let stats = {};

      if (user.role === 'client') {
        // Статистика для клиента
        const ordersResult = await client.query(
          'SELECT COUNT(*) as total_orders, COALESCE(SUM(total_amount), 0) as total_amount FROM orders WHERE client_id = (SELECT id FROM clients WHERE user_id = $1)',
          [userId]
        );

        const balanceResult = await client.query(
          `SELECT balance_after FROM deposits 
           WHERE client_id = (SELECT id FROM clients WHERE user_id = $1)
           ORDER BY created_at DESC LIMIT 1`,
          [userId]
        );

        stats = {
          totalOrders: parseInt(ordersResult.rows[0].total_orders),
          totalAmount: parseFloat(ordersResult.rows[0].total_amount),
          currentBalance: balanceResult.rows.length > 0 ? parseFloat(balanceResult.rows[0].balance_after) : 0
        };
      }

      res.json({
        user,
        stats
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Admin user details error:', err);
    res.status(500).json({ error: 'Failed to get user details' });
  }
});

// Обновление пользователя
router.put('/users/:userId', requireAdmin, [
  body('first_name').optional().notEmpty().trim(),
  body('last_name').optional().notEmpty().trim(),
  body('phone').optional().isMobilePhone('ru-RU'),
  body('is_active').optional().isBoolean(),
  body('role').optional().isIn(['client', 'operator', 'admin']),
  body('company_name').optional().trim(),
  body('inn').optional().isLength({ min: 10, max: 12 }),
  body('address').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { first_name, last_name, phone, is_active, role, company_name, inn, address } = req.body;

    const client = await pool.connect();
    try {
      // Обновляем пользователя
      await client.query(
        `UPDATE users 
         SET first_name = COALESCE($1, first_name),
             last_name = COALESCE($2, last_name),
             phone = COALESCE($3, phone),
             is_active = COALESCE($4, is_active),
             role = COALESCE($5, role),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $6`,
        [first_name, last_name, phone, is_active, role, userId]
      );

      // Если это клиент, обновляем данные клиента
      if (role === 'client' || (await client.query('SELECT role FROM users WHERE id = $1', [userId])).rows[0].role === 'client') {
        await client.query(
          `UPDATE clients 
           SET company_name = COALESCE($1, company_name),
               inn = COALESCE($2, inn),
               address = COALESCE($3, address),
               updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $4`,
          [company_name, inn, address, userId]
        );
      }

      res.json({ message: 'User updated successfully' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Admin user update error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Получение статистики системы
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      // Общая статистика
      const totalUsersResult = await client.query('SELECT COUNT(*) as count FROM users');
      const totalClientsResult = await client.query('SELECT COUNT(*) as count FROM clients');
      const totalOrdersResult = await client.query('SELECT COUNT(*) as count FROM orders');
      const totalRevenueResult = await client.query('SELECT COALESCE(SUM(total_amount), 0) as total FROM orders');

      // Статистика по ролям
      const usersByRoleResult = await client.query(
        'SELECT role, COUNT(*) as count FROM users GROUP BY role'
      );

      // Статистика по маркетплейсам
      const ordersByMarketplaceResult = await client.query(
        'SELECT marketplace, COUNT(*) as count FROM orders GROUP BY marketplace'
      );

      // Статистика по статусам заказов
      const ordersByStatusResult = await client.query(
        'SELECT status, COUNT(*) as count FROM orders GROUP BY status'
      );

      // Заказы за последние 30 дней
      const recentOrdersResult = await client.query(
        `SELECT DATE(created_at) as date, COUNT(*) as count
         FROM orders
         WHERE created_at >= NOW() - INTERVAL '30 days'
         GROUP BY DATE(created_at)
         ORDER BY date`
      );

      // Топ клиентов по количеству заказов
      const topClientsResult = await client.query(
        `SELECT c.company_name, COUNT(o.id) as order_count, COALESCE(SUM(o.total_amount), 0) as total_amount
         FROM clients c
         LEFT JOIN orders o ON c.id = o.client_id
         GROUP BY c.id, c.company_name
         ORDER BY order_count DESC
         LIMIT 10`
      );

      res.json({
        overview: {
          totalUsers: parseInt(totalUsersResult.rows[0].count),
          totalClients: parseInt(totalClientsResult.rows[0].count),
          totalOrders: parseInt(totalOrdersResult.rows[0].count),
          totalRevenue: parseFloat(totalRevenueResult.rows[0].total)
        },
        usersByRole: usersByRoleResult.rows.reduce((acc, row) => {
          acc[row.role] = parseInt(row.count);
          return acc;
        }, {}),
        ordersByMarketplace: ordersByMarketplaceResult.rows.reduce((acc, row) => {
          acc[row.marketplace] = parseInt(row.count);
          return acc;
        }, {}),
        ordersByStatus: ordersByStatusResult.rows.reduce((acc, row) => {
          acc[row.status] = parseInt(row.count);
          return acc;
        }, {}),
        recentOrders: recentOrdersResult.rows,
        topClients: topClientsResult.rows
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Failed to get system statistics' });
  }
});

// Получение всех заказов (для админа)
router.get('/orders', requireAdmin, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['new', 'in_assembly', 'ready_to_ship', 'shipped', 'delivered', 'cancelled']),
  query('marketplace').optional().isIn(['wildberries', 'ozon', 'yandex_market']),
  query('client_id').optional().isInt({ min: 1 }),
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
    const { status, marketplace, client_id, search } = req.query;

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

      if (marketplace) {
        whereClause += ` AND o.marketplace = $${paramIndex}`;
        queryParams.push(marketplace);
        paramIndex++;
      }

      if (client_id) {
        whereClause += ` AND o.client_id = $${paramIndex}`;
        queryParams.push(client_id);
        paramIndex++;
      }

      if (search) {
        whereClause += ` AND (o.customer_name ILIKE $${paramIndex} OR o.marketplace_order_id ILIKE $${paramIndex} OR c.company_name ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      // Получаем заказы
      const ordersResult = await client.query(
        `SELECT o.*, c.company_name, u.email as client_email
         FROM orders o
         JOIN clients c ON o.client_id = c.id
         JOIN users u ON c.user_id = u.id
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
         JOIN users u ON c.user_id = u.id
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
    console.error('Admin orders error:', err);
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

// Настройки системы
router.get('/settings', requireAdmin, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const settingsResult = await client.query(
        'SELECT key, value, description FROM system_settings ORDER BY key'
      );

      const settings = settingsResult.rows.reduce((acc, row) => {
        acc[row.key] = {
          value: row.value,
          description: row.description
        };
        return acc;
      }, {});

      res.json(settings);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Admin settings error:', err);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// Обновление настроек системы
router.put('/settings', requireAdmin, [
  body('settings').isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { settings } = req.body;

    const client = await pool.connect();
    try {
      for (const [key, value] of Object.entries(settings)) {
        await client.query(
          `INSERT INTO system_settings (key, value, updated_at)
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (key) DO UPDATE SET
           value = EXCLUDED.value,
           updated_at = CURRENT_TIMESTAMP`,
          [key, JSON.stringify(value.value)]
        );
      }

      res.json({ message: 'Settings updated successfully' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Admin settings update error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;



