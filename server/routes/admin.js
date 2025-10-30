const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { pool } = require('../config/database');
const { requireAdmin } = require('../middleware/auth');
const logger = require('../services/logger');

const router = express.Router();

// Комиссия админа с заказов (1.5%)
const ADMIN_COMMISSION_RATE = 0.015;

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
          `SELECT COUNT(*) as total_orders, COALESCE(SUM(total_amount) / 100.0 * ${ADMIN_COMMISSION_RATE}, 0) as total_amount FROM orders WHERE client_id = (SELECT id FROM clients WHERE user_id = $1)`,
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
      // Выручка админа = 1.5% от общей суммы заказов
      const totalRevenueResult = await client.query(`SELECT COALESCE(SUM(total_amount) / 100.0 * ${ADMIN_COMMISSION_RATE}, 0) as total FROM orders`);

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

      // Топ клиентов по количеству заказов (выручка = 1.5% от суммы заказов)
      const topClientsResult = await client.query(
        `SELECT c.company_name, COUNT(o.id) as order_count, COALESCE(SUM(o.total_amount) / 100.0 * ${ADMIN_COMMISSION_RATE}, 0) as total_amount
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

// Получение логов сервера
router.get('/logs/server', requireAdmin, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 1000 }),
  query('level').optional().isIn(['error', 'warn', 'info', 'debug']),
  query('service').optional().trim(),
  query('userId').optional().isInt({ min: 1 }),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const filters = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 100,
      level: req.query.level,
      service: req.query.service,
      userId: req.query.userId ? parseInt(req.query.userId) : null,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };

    const result = await logger.getLogs(filters);
    res.json(result);
  } catch (err) {
    console.error('Admin server logs error:', err);
    res.status(500).json({ error: 'Failed to get server logs' });
  }
});

// Получение логов клиента
router.get('/logs/client', requireAdmin, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 1000 }),
  query('level').optional().isIn(['error', 'warn', 'info', 'debug']),
  query('userId').optional().isInt({ min: 1 }),
  query('component').optional().trim(),
  query('action').optional().trim(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const filters = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 100,
      level: req.query.level,
      userId: req.query.userId ? parseInt(req.query.userId) : null,
      component: req.query.component,
      action: req.query.action,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };

    const result = await logger.getClientLogs(filters);
    res.json(result);
  } catch (err) {
    console.error('Admin client logs error:', err);
    res.status(500).json({ error: 'Failed to get client logs' });
  }
});

// Смена пароля пользователя администратором
router.put('/users/:userId/password', requireAdmin, [
  body('newPassword').isLength({ min: 8 }).withMessage('Пароль должен содержать минимум 8 символов'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('Пароли не совпадают');
    }
    return true;
  })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { newPassword } = req.body;

    const client = await pool.connect();
    try {
      // Проверяем, существует ли пользователь
      const userResult = await client.query(
        'SELECT id, email, first_name, last_name FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      const user = userResult.rows[0];

      // Хешируем новый пароль
      const bcrypt = require('bcryptjs');
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Обновляем пароль
      await client.query(
        'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newPasswordHash, userId]
      );

      // Логируем смену пароля
      await logger.info('Password changed by admin', {
        service: 'admin',
        userId: req.user.id,
        metadata: {
          targetUserId: userId,
          targetUserEmail: user.email,
          targetUserName: `${user.first_name} ${user.last_name}`
        }
      });

      res.json({ message: 'Пароль успешно изменен' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Admin password change error:', err);
    res.status(500).json({ error: 'Ошибка смены пароля' });
  }
});

// Блокировка/разблокировка пользователя
router.put('/users/:userId/status', requireAdmin, [
  body('isActive').isBoolean().withMessage('isActive должно быть boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { isActive } = req.body;

    const client = await pool.connect();
    try {
      // Проверяем, существует ли пользователь
      const userResult = await client.query(
        'SELECT id, email, first_name, last_name, is_active FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      const user = userResult.rows[0];

      // Обновляем статус
      await client.query(
        'UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [isActive, userId]
      );

      // Логируем изменение статуса
      await logger.info(`User ${isActive ? 'activated' : 'deactivated'} by admin`, {
        service: 'admin',
        userId: req.user.id,
        metadata: {
          targetUserId: userId,
          targetUserEmail: user.email,
          targetUserName: `${user.first_name} ${user.last_name}`,
          previousStatus: user.is_active,
          newStatus: isActive
        }
      });

      res.json({ 
        message: `Пользователь ${isActive ? 'активирован' : 'заблокирован'}`,
        isActive 
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Admin user status change error:', err);
    res.status(500).json({ error: 'Ошибка изменения статуса пользователя' });
  }
});

// Получение статистики логов
router.get('/logs/stats', requireAdmin, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      // Статистика по уровням логов сервера за последние 24 часа
      const serverLogsStats = await client.query(`
        SELECT level, COUNT(*) as count
        FROM server_logs
        WHERE created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY level
        ORDER BY level
      `);

      // Статистика по уровням логов клиента за последние 24 часа
      const clientLogsStats = await client.query(`
        SELECT level, COUNT(*) as count
        FROM client_logs
        WHERE created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY level
        ORDER BY level
      `);

      // Топ ошибок за последние 24 часа
      const topErrors = await client.query(`
        SELECT message, COUNT(*) as count
        FROM server_logs
        WHERE level = 'error' AND created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY message
        ORDER BY count DESC
        LIMIT 10
      `);

      // Активные пользователи за последние 24 часа
      const activeUsers = await client.query(`
        SELECT u.email, u.first_name, u.last_name, COUNT(sl.id) as log_count
        FROM users u
        JOIN server_logs sl ON u.id = sl.user_id
        WHERE sl.created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY u.id, u.email, u.first_name, u.last_name
        ORDER BY log_count DESC
        LIMIT 10
      `);

      res.json({
        serverLogs: serverLogsStats.rows,
        clientLogs: clientLogsStats.rows,
        topErrors: topErrors.rows,
        activeUsers: activeUsers.rows
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Admin logs stats error:', err);
    res.status(500).json({ error: 'Failed to get logs statistics' });
  }
});

// Создание оператора администратором (упрощенное)
router.post('/users/operator', requireAdmin, [
  body('firstName').notEmpty().trim().withMessage('Имя обязательно'),
  body('lastName').notEmpty().trim().withMessage('Фамилия обязательна')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { firstName, lastName } = req.body;
    const adminId = req.user.id;

    const client = await pool.connect();
    try {
      // Генерируем простой логин и пароль
      const login = `operator_${Date.now()}`;
      const password = Math.random().toString(36).slice(-8); // 8-символьный пароль
      const email = `${login}@internal.local`; // Внутренний email
      
      // Хешируем пароль
      const bcrypt = require('bcryptjs');
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Создаем пользователя
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, email_verified, phone_verified, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'operator', true, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id, email, first_name, last_name, role, created_at`,
        [email, passwordHash, firstName, lastName]
      );

      const newUser = userResult.rows[0];

      // Логируем создание оператора
      await logger.info('Operator created by admin', {
        service: 'admin',
        userId: adminId,
        metadata: {
          operatorId: newUser.id,
          operatorLogin: login,
          operatorName: `${firstName} ${lastName}`,
          adminId: adminId
        }
      });

      res.json({
        message: 'Оператор успешно создан',
        credentials: {
          login: login,
          password: password
        },
        user: {
          id: newUser.id,
          firstName: newUser.first_name,
          lastName: newUser.last_name,
          role: newUser.role,
          createdAt: newUser.created_at
        }
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create operator error:', err);
    res.status(500).json({ error: 'Ошибка создания оператора' });
  }
});

// Логирование клиентских логов
router.post('/logs/client', requireAdmin, [
  body('level').isIn(['error', 'warn', 'info', 'debug']).withMessage('Неверный уровень лога'),
  body('message').notEmpty().withMessage('Сообщение обязательно'),
  body('component').optional().trim(),
  body('action').optional().trim(),
  body('url').optional().isURL().withMessage('Неверный URL'),
  body('metadata').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { level, message, component, action, url, metadata = {} } = req.body;
    const userId = req.user.id;

    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO client_logs (user_id, level, message, component, action, url, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, level, message, component, action, url, JSON.stringify(metadata)]
      );

      res.json({ message: 'Лог успешно сохранен' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Client log error:', err);
    res.status(500).json({ error: 'Ошибка сохранения лога' });
  }
});

// Удаление пользователя
router.delete('/users/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user.id;

    // Проверяем, что администратор не пытается удалить себя
    if (parseInt(userId) === adminId) {
      return res.status(400).json({ error: 'Нельзя удалить собственный аккаунт' });
    }

    const client = await pool.connect();
    try {
      // Проверяем, что пользователь существует
      const userResult = await client.query(
        'SELECT id, role, email, first_name, last_name FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      const user = userResult.rows[0];

      // Проверяем, что нельзя удалить другого администратора
      if (user.role === 'admin') {
        return res.status(400).json({ error: 'Нельзя удалить администратора' });
      }

      // Проверяем, есть ли у пользователя активные заказы (если таблица существует)
      let activeOrdersCount = 0;
      try {
        const ordersResult = await client.query(
          'SELECT COUNT(*) as count FROM orders WHERE user_id = $1 AND status NOT IN ($2, $3)',
          [userId, 'completed', 'cancelled']
        );
        activeOrdersCount = parseInt(ordersResult.rows[0].count);
      } catch (ordersError) {
        console.warn('Failed to check orders:', ordersError.message);
        // Если таблица orders не существует, пропускаем проверку
      }

      if (activeOrdersCount > 0) {
        return res.status(400).json({ 
          error: `Нельзя удалить пользователя с активными заказами (${activeOrdersCount} заказов)`
        });
      }

      // Удаляем пользователя
      await client.query('DELETE FROM users WHERE id = $1', [userId]);

      // Логируем действие (если таблица существует)
      try {
        await client.query(
          `INSERT INTO admin_logs (admin_id, action, details, created_at) 
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
          [
            adminId,
            'user_deleted',
            JSON.stringify({
              deletedUserId: userId,
              deletedUserEmail: user.email,
              deletedUserName: `${user.first_name} ${user.last_name}`,
              deletedUserRole: user.role
            })
          ]
        );
      } catch (logError) {
        console.warn('Failed to log admin action:', logError.message);
        // Не прерываем выполнение, если логирование не удалось
      }

      res.json({ 
        message: 'Пользователь успешно удален',
        deletedUser: {
          id: user.id,
          email: user.email,
          name: `${user.first_name} ${user.last_name}`,
          role: user.role
        }
      });

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      userId: req.params.userId,
      adminId: req.user?.id
    });
    res.status(500).json({ 
      error: 'Ошибка при удалении пользователя',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Получение списка платежных поручений для проверки
router.get('/payment-orders', requireAdmin, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['pending', 'verified', 'rejected']),
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
    const { status, search } = req.query;

    const client = await pool.connect();
    try {
      let whereClause = 'WHERE 1=1';
      let queryParams = [];
      let paramIndex = 1;

      if (status) {
        whereClause += ` AND po.status = $${paramIndex}`;
        queryParams.push(status);
        paramIndex++;
      }

      if (search) {
        whereClause += ` AND (c.company_name ILIKE $${paramIndex} OR po.purpose ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      // Получаем платежные поручения
      const ordersResult = await client.query(
        `SELECT po.*, c.company_name, c.inn, c.address, u.email, u.first_name, u.last_name,
                d.payment_id, d.invoice_number, d.created_at as deposit_created_at
         FROM payment_orders po
         JOIN clients c ON po.client_id = c.id
         JOIN users u ON c.user_id = u.id
         JOIN deposits d ON po.deposit_id = d.id
         ${whereClause}
         ORDER BY po.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...queryParams, limit, offset]
      );

      // Получаем общее количество
      const countResult = await client.query(
        `SELECT COUNT(*) as total
         FROM payment_orders po
         JOIN clients c ON po.client_id = c.id
         JOIN users u ON c.user_id = u.id
         JOIN deposits d ON po.deposit_id = d.id
         ${whereClause}`,
        queryParams
      );

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      res.json({
        paymentOrders: ordersResult.rows,
        pagination: {
          currentPage: page,
          totalPages,
          total,
          limit
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching payment orders:', error);
    res.status(500).json({ error: 'Ошибка получения списка платежных поручений' });
  }
});

// Проверка платежного поручения
router.post('/payment-orders/:orderId/verify', requireAdmin, [
  body('status').isIn(['verified', 'rejected']),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orderId } = req.params;
    const { status, notes } = req.body;

    const client = await pool.connect();
    try {
      // Получаем информацию о платежном поручении
      const orderResult = await client.query(
        `SELECT po.*, d.client_id, d.amount, d.balance_before, d.status as deposit_status
         FROM payment_orders po
         JOIN deposits d ON po.deposit_id = d.id
         WHERE po.id = $1`,
        [orderId]
      );

      if (orderResult.rows.length === 0) {
        return res.status(404).json({ error: 'Платежное поручение не найдено' });
      }

      const order = orderResult.rows[0];

      // Обновляем статус платежного поручения
      await client.query(
        'UPDATE payment_orders SET status = $1, verified_at = CURRENT_TIMESTAMP, verified_by = $2, rejection_reason = $3 WHERE id = $4',
        [status, req.user.id, status === 'rejected' ? notes : null, orderId]
      );

      // Если платеж подтвержден, обновляем статус депозита и баланс
      if (status === 'verified' && order.deposit_status === 'pending') {
        const newBalance = order.balance_before + order.amount;
        
        await client.query(
          'UPDATE deposits SET status = $1, balance_after = $2, bank_verification_status = $3, bank_verification_date = CURRENT_TIMESTAMP WHERE id = $4',
          ['completed', newBalance, 'verified', order.deposit_id]
        );

        // Отправляем уведомление клиенту
        await client.query(
          `INSERT INTO notifications (user_id, type, title, message)
           SELECT c.user_id, 'internal', 'Депозит пополнен', 
                  'Ваш депозит пополнен на ${order.amount} ₽. Новый баланс: ${newBalance} ₽'
           FROM clients c WHERE c.id = $1`,
          [order.client_id]
        );
      } else if (status === 'rejected') {
        // Если платеж отклонен, обновляем статус депозита
        await client.query(
          'UPDATE deposits SET status = $1, bank_verification_status = $2, bank_verification_notes = $3 WHERE id = $4',
          ['failed', 'rejected', notes, order.deposit_id]
        );

        // Отправляем уведомление клиенту
        await client.query(
          `INSERT INTO notifications (user_id, type, title, message)
           SELECT c.user_id, 'internal', 'Депозит отклонен', 
                  'Ваш депозит отклонен. Причина: ${notes || 'Не указана'}'
           FROM clients c WHERE c.id = $1`,
          [order.client_id]
        );
      }

      // Логируем действие администратора
      try {
        await client.query(
          `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip_address, user_agent)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            req.user.id,
            'payment_order_verification',
            'payment_order',
            orderId,
            JSON.stringify({
              orderId,
              status,
              notes,
              amount: order.amount,
              clientId: order.client_id
            }),
            req.ip,
            req.get('User-Agent')
          ]
        );
      } catch (logError) {
        console.warn('Failed to log admin action:', logError.message);
      }

      res.json({ 
        message: `Платежное поручение ${status === 'verified' ? 'подтверждено' : 'отклонено'}`,
        orderId,
        status
      });

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error verifying payment order:', error);
    res.status(500).json({ error: 'Ошибка проверки платежного поручения' });
  }
});

// Скачивание файла платежного поручения
router.get('/payment-orders/:orderId/download', requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;

    const client = await pool.connect();
    try {
      const orderResult = await client.query(
        'SELECT payment_order_file_path FROM payment_orders WHERE id = $1',
        [orderId]
      );

      if (orderResult.rows.length === 0) {
        return res.status(404).json({ error: 'Платежное поручение не найдено' });
      }

      const order = orderResult.rows[0];

      if (!order.payment_order_file_path) {
        return res.status(404).json({ error: 'Файл платежного поручения не найден' });
      }

      const fs = require('fs');
      const path = require('path');
      const filePath = order.payment_order_file_path;
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Файл не найден на сервере' });
      }

      res.download(filePath, `payment_order_${orderId}.pdf`);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error downloading payment order file:', error);
    res.status(500).json({ error: 'Ошибка скачивания файла' });
  }
});

// ===== УПРАВЛЕНИЕ ВОЗВРАТАМИ =====

// Получение списка возвратов
router.get('/returns', requireAdmin, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['pending', 'approved', 'rejected', 'processed']),
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
    const { status, search } = req.query;

    const client = await pool.connect();
    try {
      let whereClause = 'WHERE 1=1';
      let queryParams = [];
      let paramIndex = 1;

      if (status) {
        whereClause += ` AND pr.return_status = $${paramIndex}`;
        queryParams.push(status);
        paramIndex++;
      }

      if (search) {
        whereClause += ` AND (pr.article ILIKE $${paramIndex} OR o.marketplace_order_id ILIKE $${paramIndex} OR c.company_name ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      // Получаем возвраты
      const returnsResult = await client.query(
        `SELECT pr.*, o.marketplace_order_id, o.marketplace, o.customer_name, o.customer_phone,
                c.company_name, u.email, u.first_name, u.last_name
         FROM product_returns pr
         JOIN orders o ON pr.order_id = o.id
         JOIN clients c ON o.client_id = c.id
         JOIN users u ON c.user_id = u.id
         ${whereClause}
         ORDER BY pr.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...queryParams, limit, offset]
      );

      // Получаем общее количество
      const countResult = await client.query(
        `SELECT COUNT(*) as total
         FROM product_returns pr
         JOIN orders o ON pr.order_id = o.id
         JOIN clients c ON o.client_id = c.id
         JOIN users u ON c.user_id = u.id
         ${whereClause}`,
        queryParams
      );

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      res.json({
        returns: returnsResult.rows,
        pagination: {
          currentPage: page,
          totalPages,
          total,
          limit
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching returns:', error);
    res.status(500).json({ error: 'Ошибка получения списка возвратов' });
  }
});

// Обработка возврата товара
router.post('/returns/:returnId/process', requireAdmin, [
  body('action').isIn(['approve', 'reject']),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { returnId } = req.params;
    const { action, notes } = req.body;

    const client = await pool.connect();
    try {
      // Получаем информацию о возврате
      const returnResult = await client.query(
        `SELECT pr.*, o.client_id, o.marketplace_order_id, o.marketplace
         FROM product_returns pr
         JOIN orders o ON pr.order_id = o.id
         WHERE pr.id = $1`,
        [returnId]
      );

      if (returnResult.rows.length === 0) {
        return res.status(404).json({ error: 'Возврат не найден' });
      }

      const returnData = returnResult.rows[0];

      if (returnData.return_status !== 'pending') {
        return res.status(400).json({ error: 'Возврат уже обработан' });
      }

      let newStatus;
      let message;

      if (action === 'approve') {
        newStatus = 'approved';
        message = 'Возврат одобрен';

        // Обрабатываем возврат средств
        const orderPaymentService = require('../services/orderPaymentService');
        const refundResult = await orderPaymentService.processProductReturn(
          returnData.order_id,
          returnData.article,
          returnData.quantity,
          returnData.return_reason
        );

        if (!refundResult.success) {
          return res.status(400).json({ 
            error: 'Ошибка обработки возврата средств',
            details: refundResult.error
          });
        }

        // Обновляем статус возврата
        await client.query(
          'UPDATE product_returns SET return_status = $1, processed_at = CURRENT_TIMESTAMP, processed_by = $2, notes = $3 WHERE id = $4',
          [newStatus, req.user.id, notes, returnId]
        );

        // Отправляем уведомление клиенту
        await client.query(
          `INSERT INTO notifications (user_id, type, title, message)
           SELECT c.user_id, 'internal', 'Возврат одобрен', 
                  'Ваш возврат товара ${returnData.article} по заказу ${returnData.marketplace_order_id} одобрен. Возвращено ${refundResult.refundAmount} ₽'
           FROM clients c WHERE c.id = $1`,
          [returnData.client_id]
        );

      } else {
        newStatus = 'rejected';
        message = 'Возврат отклонен';

        // Обновляем статус возврата
        await client.query(
          'UPDATE product_returns SET return_status = $1, processed_at = CURRENT_TIMESTAMP, processed_by = $2, notes = $3 WHERE id = $4',
          [newStatus, req.user.id, notes, returnId]
        );

        // Отправляем уведомление клиенту
        await client.query(
          `INSERT INTO notifications (user_id, type, title, message)
           SELECT c.user_id, 'internal', 'Возврат отклонен', 
                  'Ваш возврат товара ${returnData.article} по заказу ${returnData.marketplace_order_id} отклонен. Причина: ${notes || 'Не указана'}'
           FROM clients c WHERE c.id = $1`,
          [returnData.client_id]
        );
      }

      // Логируем действие администратора
      try {
        await client.query(
          `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip_address, user_agent)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            req.user.id,
            'return_processing',
            'product_return',
            returnId,
            JSON.stringify({
              returnId,
              action,
              notes,
              article: returnData.article,
              quantity: returnData.quantity,
              orderId: returnData.marketplace_order_id
            }),
            req.ip,
            req.get('User-Agent')
          ]
        );
      } catch (logError) {
        console.warn('Failed to log admin action:', logError.message);
      }

      res.json({ 
        message,
        returnId,
        status: newStatus
      });

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error processing return:', error);
    res.status(500).json({ error: 'Ошибка обработки возврата' });
  }
});

// ===== ТОВАРЫ МАГАЗИНА =====

// Получение списка карточек товаров для клиента
router.get('/store-products/:clientId', requireAdmin, async (req, res) => {
  try {
    const { clientId } = req.params;
    
    const client = await pool.connect();
    try {
      const productsResult = await client.query(
        `SELECT * FROM wb_products_cache 
         WHERE client_id = $1 
         ORDER BY last_updated DESC, created_at DESC`,
        [clientId]
      );

      res.json({
        products: productsResult.rows,
        total: productsResult.rows.length
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Store products error:', err);
    res.status(500).json({ error: 'Ошибка получения товаров' });
  }
});

// Загрузка карточек товаров через Wildberries API
router.post('/store-products/:clientId/load', requireAdmin, async (req, res) => {
  try {
    const { clientId } = req.params;
    
    const client = await pool.connect();
    try {
      // Получаем API ключ клиента
      const clientResult = await client.query(
        `SELECT api_keys FROM clients WHERE id = $1`,
        [clientId]
      );

      if (clientResult.rows.length === 0) {
        return res.status(404).json({ error: 'Клиент не найден' });
      }

      const apiKeys = clientResult.rows[0].api_keys || {};
      const wildberriesKey = apiKeys.wildberries?.api_key;

      if (!wildberriesKey) {
        return res.status(400).json({ 
          error: 'API ключ Wildberries не настроен',
          details: 'Необходимо настроить API ключ в настройках клиента'
        });
      }

      // Получаем user_id клиента
      const userResult = await client.query(
        `SELECT user_id FROM clients WHERE id = $1`,
        [clientId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'Пользователь клиента не найден' });
      }

      const userId = userResult.rows[0].user_id;

      // Используем существующий сервис для получения товаров
      const WildberriesPricingService = require('../services/wildberriesPricingService');
      const wbService = new WildberriesPricingService();
      
      const products = await wbService.fetchSupplierProducts(wildberriesKey, userId);

      // Возвращаем результат
      res.json({
        success: true,
        message: `Загружено ${products.length} товаров`,
        products: products.map(p => ({
          nm_id: p.nm_id,
          article: p.article,
          name: p.name,
          brand: p.brand,
          category: p.category,
          current_price: p.current_price,
          commission_percent: p.commission_percent,
          logistics_cost: p.logistics_cost,
          is_active: p.is_active
        }))
      });

      // Логируем действие
      try {
        await client.query(
          `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            req.user.id,
            'store_products_loaded',
            'client',
            clientId,
            JSON.stringify({
              clientId,
              productsCount: products.length,
              timestamp: new Date().toISOString()
            })
          ]
        );
      } catch (logError) {
        console.warn('Failed to log admin action:', logError.message);
      }

    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Load store products error:', err);
    res.status(500).json({ 
      error: 'Ошибка загрузки товаров',
      details: err.message 
    });
  }
});

// Получение детальной информации о товаре
router.get('/store-products/:clientId/product/:nmId', requireAdmin, async (req, res) => {
  try {
    const { clientId, nmId } = req.params;
    
    const client = await pool.connect();
    try {
      const productResult = await client.query(
        `SELECT * FROM wb_products_cache 
         WHERE client_id = $1 AND nm_id = $2`,
        [clientId, nmId]
      );

      if (productResult.rows.length === 0) {
        return res.status(404).json({ error: 'Товар не найден' });
      }

      res.json({ product: productResult.rows[0] });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get product error:', err);
    res.status(500).json({ error: 'Ошибка получения товара' });
  }
});

module.exports = router;



