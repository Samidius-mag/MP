const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { pool } = require('../config/database');
const { requireClient } = require('../middleware/auth');
const DepositService = require('../services/depositService');
const axios = require('axios');

const router = express.Router();

// Получение баланса клиента
router.get('/balance', requireClient, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      // Получаем последний баланс из депозитов
      const balanceResult = await client.query(
        `SELECT balance_after 
         FROM deposits 
         WHERE client_id = (SELECT id FROM clients WHERE user_id = $1)
         ORDER BY created_at DESC 
         LIMIT 1`,
        [req.user.id]
      );

      const currentBalance = balanceResult.rows.length > 0 
        ? parseFloat(balanceResult.rows[0].balance_after) 
        : 0;

      res.json({ balance: currentBalance });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Balance error:', err);
    res.status(500).json({ error: 'Failed to get balance' });
  }
});

// История операций с депозитом
router.get('/deposits', requireClient, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('type').optional().isIn(['deposit', 'withdrawal', 'order_payment'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const type = req.query.type;

    const client = await pool.connect();
    try {
      let whereClause = 'WHERE c.user_id = $1';
      let queryParams = [req.user.id];
      let paramIndex = 2;

      if (type) {
        whereClause += ` AND d.transaction_type = $${paramIndex}`;
        queryParams.push(type);
        paramIndex++;
      }

      // Получаем депозиты
      const depositsResult = await client.query(
        `SELECT d.*, c.company_name
         FROM deposits d
         JOIN clients c ON d.client_id = c.id
         ${whereClause}
         ORDER BY d.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...queryParams, limit, offset]
      );

      // Получаем общее количество
      const countResult = await client.query(
        `SELECT COUNT(*) as total
         FROM deposits d
         JOIN clients c ON d.client_id = c.id
         ${whereClause}`,
        queryParams
      );

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      res.json({
        deposits: depositsResult.rows,
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
    console.error('Deposits history error:', err);
    res.status(500).json({ error: 'Failed to get deposits history' });
  }
});

// Получение заказов клиента
router.get('/orders', requireClient, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['new', 'in_assembly', 'ready_to_ship', 'shipped', 'delivered', 'cancelled']),
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
    const { status, marketplace, search } = req.query;

    const client = await pool.connect();
    try {
      let whereClause = 'WHERE c.user_id = $1';
      let queryParams = [req.user.id];
      let paramIndex = 2;

      if (status) {
        whereClause += ` AND o.status = $${paramIndex}`;
        queryParams.push(status);
        paramIndex++;
        // Защита от "зависших" новых заказов: скрываем слишком старые new из текущей вкладки
        if (status === 'new') {
          whereClause += " AND o.created_at > NOW() - INTERVAL '1 day'";
        }
      }

      if (marketplace) {
        whereClause += ` AND o.marketplace = $${paramIndex}`;
        queryParams.push(marketplace);
        paramIndex++;
      }

      if (search) {
        whereClause += ` AND (o.customer_name ILIKE $${paramIndex} OR o.marketplace_order_id ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      // Получаем заказы
      const ordersResult = await client.query(
        `SELECT o.*, c.company_name
         FROM orders o
         JOIN clients c ON o.client_id = c.id
         ${whereClause}
         ORDER BY o.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...queryParams, limit, offset]
      );

      // Получаем товары для каждого заказа из JSON поля items (обогащённые данные)
      for (let order of ordersResult.rows) {
        // Если есть JSON поле items с обогащёнными данными - используем его
        if (order.items && typeof order.items === 'object') {
          // items уже в правильном формате из JSON поля
          order.items = Array.isArray(order.items) ? order.items : [];
        } else {
          // Fallback: получаем из отдельной таблицы order_items
          const itemsResult = await client.query(
            'SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at',
            [order.id]
          );
          order.items = itemsResult.rows;
        }
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
    console.error('Orders error:', err);
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

// Проверка заказа по номеру
router.get('/orders/check/:orderNumber', requireClient, async (req, res) => {
  try {
    const { orderNumber } = req.params;
    console.log(`🔍 Проверка заказа ${orderNumber} для пользователя ${req.user.id}`);

    const client = await pool.connect();
    try {
      // Получаем API ключи клиента (для WB статусов)
      const apiKeysResult = await client.query(
        'SELECT id, api_keys FROM clients WHERE user_id = $1',
        [req.user.id]
      );
      if (apiKeysResult.rows.length === 0) {
        console.log('❌ Клиент не найден для пользователя:', req.user.id);
        return res.status(404).json({ error: 'Client not found' });
      }
      const clientRow = apiKeysResult.rows[0];
      const apiKeys = clientRow.api_keys || {};
      console.log('🔑 API ключи клиента:', Object.keys(apiKeys));

      // Ищем заказ по номеру в базе данных
      const orderResult = await client.query(
        `SELECT o.*, c.company_name
         FROM orders o
         JOIN clients c ON o.client_id = c.id
         WHERE o.marketplace_order_id = $1 AND c.user_id = $2`,
        [orderNumber, req.user.id]
      );

      if (orderResult.rows.length === 0) {
        console.log('❌ Заказ не найден в БД:', orderNumber);
        return res.status(404).json({ error: 'Заказ не найден' });
      }

      const order = orderResult.rows[0];
      console.log('✅ Заказ найден в БД:', {
        id: order.id,
        marketplace: order.marketplace,
        order_type: order.order_type,
        status: order.status
      });

      // Получаем товары заказа
      const itemsResult = await client.query(
        'SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at',
        [order.id]
      );

      // Получаем стикеры заказа
      const stickersResult = await client.query(
        'SELECT * FROM stickers WHERE order_id = $1 ORDER BY created_at',
        [order.id]
      );

      order.items = itemsResult.rows;
      order.stickers = stickersResult.rows;

      // Дополнительная информация по WB: supplierStatus и wbStatus через API статусов
      if (order.marketplace === 'wildberries' && apiKeys.wildberries?.api_key) {
        console.log('🛒 Заказ WB, пытаемся получить статусы...');
        try {
          // Определяем тип заказа (используем сохранённый order_type, при отсутствии — FBS)
          const orderType = (order.order_type || 'FBS').toUpperCase();
          console.log('📋 Тип заказа:', orderType);

          // Получаем доступные сборочные задания, чтобы сопоставить id
          console.log('🔍 Получаем сборочные задания...');
          const assignments = await fetchWildberriesAssignmentsByType(apiKeys.wildberries.api_key, orderType);
          console.log('📦 Найдено заданий:', assignments?.length || 0);

          // Пытаемся найти id задания по известным ключам (marketplace_order_id может быть gNumber/srid)
          let assignmentId = undefined;
          const asMap = new Map();
          for (const it of assignments || []) {
            const id = it.id || it.orderId || it.orderID || it.uid || it.orderUid;
            const keys = [it.gNumber, it.srid].filter(Boolean).map(String);
            if (id && keys.length > 0) {
              for (const k of keys) asMap.set(k, String(id));
            }
          }
          const candidate = String(order.marketplace_order_id);
          assignmentId = asMap.get(candidate);
          console.log('🔗 Поиск ID задания для:', candidate, '->', assignmentId || 'не найден');

          // Если id найден — запрашиваем статусы
          if (assignmentId) {
            console.log('📡 Запрашиваем статусы для ID:', assignmentId);
            const statuses = await fetchWildberriesOrderStatusesByType(
              apiKeys.wildberries.api_key,
              [assignmentId],
              orderType
            );
            console.log('📊 Получены статусы:', statuses);
            if (Array.isArray(statuses) && statuses.length > 0) {
              const st = statuses[0];
              order.supplierStatus = st.supplierStatus || null;
              order.wbStatus = st.wbStatus || null;
              console.log('✅ Статусы добавлены:', {
                supplierStatus: order.supplierStatus,
                wbStatus: order.wbStatus
              });
            }
          } else {
            console.log('⚠️ ID сборочного задания не найден, статусы не получены');
          }
        } catch (e) {
          console.error('❌ WB order check enrichment failed:', e.response?.data || e.message);
        }
      } else {
        console.log('ℹ️ Заказ не WB или нет API ключа, пропускаем получение статусов');
      }

      console.log('📤 Отправляем ответ клиенту:', {
        id: order.id,
        marketplace: order.marketplace,
        status: order.status,
        supplierStatus: order.supplierStatus,
        wbStatus: order.wbStatus
      });
      res.json(order);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ Order check error:', err);
    res.status(500).json({ error: 'Failed to check order' });
  }
});

// Получение деталей заказа
router.get('/orders/:orderId', requireClient, async (req, res) => {
  try {
    const { orderId } = req.params;

    const client = await pool.connect();
    try {
      // Получаем заказ
      const orderResult = await client.query(
        `SELECT o.*, c.company_name
         FROM orders o
         JOIN clients c ON o.client_id = c.id
         WHERE o.id = $1 AND c.user_id = $2`,
        [orderId, req.user.id]
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

      // Получаем стикеры заказа
      const stickersResult = await client.query(
        'SELECT * FROM stickers WHERE order_id = $1 ORDER BY created_at',
        [orderId]
      );

      order.items = itemsResult.rows;
      order.stickers = stickersResult.rows;

      res.json(order);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Order details error:', err);
    res.status(500).json({ error: 'Failed to get order details' });
  }
});

// Получение API ключей маркетплейсов
router.get('/api-keys', requireClient, async (req, res) => {
  try {
    console.log('Fetching API keys for user:', req.user.id);
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT api_keys FROM clients WHERE user_id = $1',
        [req.user.id]
      );

      if (result.rows.length === 0) {
        console.log('Client not found for user:', req.user.id);
        return res.status(404).json({ error: 'Client not found' });
      }

      const apiKeys = result.rows[0].api_keys || {};
      console.log('Raw api_keys from DB:', apiKeys);
      
      const response = { 
        apiKeys: {
          wildberries: apiKeys.wildberries || { api_key: '' },
          ozon: apiKeys.ozon || { api_key: '', client_id: '' },
          yandex_market: apiKeys.yandex_market || { api_key: '', business_id: '', warehouse_id: '' },
          sima_land: apiKeys.sima_land || { token: '' }
        }
      };
      
      console.log('Response API keys:', response);
      res.json(response);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('API keys fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

// Получение истории заказов пользователя
router.get('/orders-history', requireClient, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('marketplace').optional().isIn(['wildberries', 'ozon', 'yandex_market']),
  query('status').optional().isIn(['new', 'in_assembly', 'ready_to_ship', 'shipped', 'delivered', 'cancelled'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const marketplace = req.query.marketplace;
    const status = req.query.status;

    const client = await pool.connect();
    try {
      let whereClause = 'WHERE c.user_id = $1';
      let queryParams = [req.user.id];
      let paramIndex = 2;

      if (marketplace) {
        whereClause += ` AND o.marketplace = $${paramIndex}`;
        queryParams.push(marketplace);
        paramIndex++;
      }

      if (status) {
        whereClause += ` AND o.status = $${paramIndex}`;
        queryParams.push(status);
        paramIndex++;
      }

      // Получаем заказы
      const ordersResult = await client.query(
        `SELECT o.*, c.company_name
         FROM orders o
         JOIN clients c ON o.client_id = c.id
         ${whereClause}
         ORDER BY o.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...queryParams, limit, offset]
      );

      // Получаем товары для каждого заказа из JSON поля items (обогащённые данные)
      for (let order of ordersResult.rows) {
        // Если есть JSON поле items с обогащёнными данными - используем его
        if (order.items && typeof order.items === 'object') {
          // items уже в правильном формате из JSON поля
          order.items = Array.isArray(order.items) ? order.items : [];
        } else {
          // Fallback: получаем из отдельной таблицы order_items
          const itemsResult = await client.query(
            'SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at',
            [order.id]
          );
          order.items = itemsResult.rows;
        }
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
    console.error('Orders history error:', err);
    res.status(500).json({ error: 'Failed to fetch orders history' });
  }
});

// Импорт заказов с маркетплейсов
router.post('/import-orders', requireClient, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      // Получаем API ключи клиента
      const clientResult = await client.query(
        'SELECT api_keys FROM clients WHERE user_id = $1',
        [req.user.id]
      );

      if (clientResult.rows.length === 0) {
        return res.status(404).json({ error: 'Client not found' });
      }

      const apiKeys = clientResult.rows[0].api_keys || {};
      let importedOrders = [];

      // Импортируем заказы с Wildberries
      if (apiKeys.wildberries?.api_key) {
        try {
          const wbOrders = await fetchWildberriesOrders(apiKeys.wildberries.api_key);
          importedOrders = [...importedOrders, ...wbOrders];
        } catch (error) {
          console.error('Wildberries import error:', error);
          
          // Специальная обработка ошибки "token scope not allowed"
          if (error.response?.status === 401 && error.response?.data?.detail === 'token scope not allowed') {
            return res.status(401).json({ 
              error: 'Wildberries API token scope not allowed',
              details: 'Your API token does not have permissions for Marketplace API. Please create a new token with "Marketplace" category in your Wildberries seller panel.',
              solution: {
                steps: [
                  'Go to Wildberries seller panel',
                  'Navigate to Profile → Integrations → API',
                  'Create a NEW token with "Marketplace" category',
                  'Update the API key in system settings'
                ]
              }
            });
          }
        }
      }

      // Импортируем заказы с Ozon
      if (apiKeys.ozon?.api_key && apiKeys.ozon?.client_id) {
        try {
          const ozonOrders = await fetchOzonOrders(apiKeys.ozon.api_key, apiKeys.ozon.client_id);
          importedOrders = [...importedOrders, ...ozonOrders];
        } catch (error) {
          console.error('Ozon import error:', error);
        }
      }

      // Импортируем заказы с Яндекс.Маркет
      if (apiKeys.yandex_market?.api_key) {
        try {
          const yandexOrders = await fetchYandexMarketOrders(apiKeys.yandex_market.api_key);
          importedOrders = [...importedOrders, ...yandexOrders];
        } catch (error) {
          console.error('Yandex Market import error:', error);
        }
      }

      // Сохраняем заказы в базу данных
      const clientIdResult = await client.query(
        'SELECT id FROM clients WHERE user_id = $1',
        [req.user.id]
      );
      const clientId = clientIdResult.rows[0].id;

      let savedOrders = 0;
      for (const order of importedOrders) {
        try {
          await client.query(
            `INSERT INTO orders (client_id, marketplace_order_id, marketplace, status, total_amount, customer_name, customer_phone, customer_email, delivery_address, items, created_at, order_type)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT (client_id, marketplace_order_id, marketplace) DO UPDATE SET
             status = EXCLUDED.status,
             total_amount = EXCLUDED.total_amount,
             customer_name = EXCLUDED.customer_name,
             customer_phone = EXCLUDED.customer_phone,
             customer_email = EXCLUDED.customer_email,
             delivery_address = EXCLUDED.delivery_address,
             items = EXCLUDED.items,
             order_type = EXCLUDED.order_type,
             updated_at = CURRENT_TIMESTAMP`,
            [
              clientId,
              order.orderId,
              order.marketplace,
              order.status,
              order.totalAmount,
              order.customerName,
              order.customerPhone,
              order.customerEmail,
              order.deliveryAddress,
              JSON.stringify(order.items),
              order.orderDate || new Date().toISOString(),
              order.orderType || 'FBS'
            ]
          );
          savedOrders++;
        } catch (error) {
          console.error('Error saving order:', error);
        }
      }

      res.json({
        success: true,
        message: `Импортировано ${savedOrders} заказов`,
        imported: savedOrders,
        total: importedOrders.length
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Import orders error:', err);
    res.status(500).json({ error: 'Failed to import orders' });
  }
});

// Настройка API ключей маркетплейсов
router.put('/api-keys', requireClient, [
  body('wildberries').optional().isObject(),
  body('ozon').optional().isObject(),
  body('yandex_market').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

      const { wildberries, ozon, yandex_market, sima_land } = req.body;

    // Проверяем Wildberries API токен если он указан
    if (wildberries?.api_key) {
      try {
        console.log('Testing Wildberries API token...');
        const testResponse = await axios.get('https://common-api.wildberries.ru/api/v1/seller-info', {
          headers: { 'Authorization': wildberries.api_key }
        });
        console.log('✅ Wildberries API token is valid');
      } catch (testError) {
        console.error('❌ Wildberries API token test failed:', testError.response?.data || testError.message);
        
        if (testError.response?.status === 401) {
          return res.status(400).json({ 
            error: 'Invalid Wildberries API token',
            details: 'The provided API token is invalid or expired. Please check your token in the Wildberries seller panel.',
            field: 'wildberries.api_key'
          });
        }
      }
    }

    const client = await pool.connect();
    try {
      // Получаем текущие API ключи
      const currentKeysResult = await client.query(
        'SELECT api_keys FROM clients WHERE user_id = $1',
        [req.user.id]
      );

      let currentKeys = {};
      if (currentKeysResult.rows.length > 0) {
        currentKeys = currentKeysResult.rows[0].api_keys || {};
      }

      // Обновляем API ключи
      const updatedKeys = {
        ...currentKeys,
        ...(wildberries && { wildberries }),
        ...(ozon && { ozon }),
        ...(yandex_market && { yandex_market }),
        ...(sima_land && { sima_land })
      };

      await client.query(
        'UPDATE clients SET api_keys = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
        [JSON.stringify(updatedKeys), req.user.id]
      );

      res.json({ 
        message: 'API keys updated successfully',
        apiKeys: updatedKeys
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('API keys update error:', err);
    res.status(500).json({ error: 'Failed to update API keys' });
  }
});

// Получение статистики клиента
router.get('/stats', requireClient, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      // Общее количество заказов
      const totalOrdersResult = await client.query(
        `SELECT COUNT(*) as total
         FROM orders o
         JOIN clients c ON o.client_id = c.id
         WHERE c.user_id = $1`,
        [req.user.id]
      );

      // Заказы по статусам
      const ordersByStatusResult = await client.query(
        `SELECT status, COUNT(*) as count
         FROM orders o
         JOIN clients c ON o.client_id = c.id
         WHERE c.user_id = $1
         GROUP BY status`,
        [req.user.id]
      );

      // Заказы по маркетплейсам
      const ordersByMarketplaceResult = await client.query(
        `SELECT marketplace, COUNT(*) as count
         FROM orders o
         JOIN clients c ON o.client_id = c.id
         WHERE c.user_id = $1
         GROUP BY marketplace`,
        [req.user.id]
      );

      // Общая сумма заказов (приводим из копеек к рублям)
      const totalAmountResult = await client.query(
        `SELECT COALESCE(SUM(total_amount) / 100.0, 0) as total
         FROM orders o
         JOIN clients c ON o.client_id = c.id
         WHERE c.user_id = $1`,
        [req.user.id]
      );

      // Заказы за сегодня
      const recentOrdersResult = await client.query(
        `SELECT COUNT(*) as count
         FROM orders o
         JOIN clients c ON o.client_id = c.id
         WHERE c.user_id = $1 AND o.created_at >= date_trunc('day', NOW())`,
        [req.user.id]
      );

      res.json({
        totalOrders: parseInt(totalOrdersResult.rows[0].total),
        ordersByStatus: ordersByStatusResult.rows.reduce((acc, row) => {
          acc[row.status] = parseInt(row.count);
          return acc;
        }, {}),
        ordersByMarketplace: ordersByMarketplaceResult.rows.reduce((acc, row) => {
          acc[row.marketplace] = parseInt(row.count);
          return acc;
        }, {}),
        totalAmount: parseFloat(totalAmountResult.rows[0].total),
        recentOrders: parseInt(recentOrdersResult.rows[0].count)
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

// Вспомогательные функции для получения заказов с маркетплейсов

// Вспомогательная функция вызова нужного WB эндпоинта статусов по типу заказа
async function fetchWildberriesOrderStatusesByType(apiKey, orderIds, orderType) {
  if (!orderIds || orderIds.length === 0) return [];
  const uniqueIds = Array.from(new Set(orderIds));
  const base = 'https://marketplace-api.wildberries.ru/api/v3';
  let path = '/orders/status'; // FBS по умолчанию
  if (orderType === 'DBW') path = '/dbw/orders/status';
  if (orderType === 'DBS') path = '/dbs/orders/status';

  try {
    console.log(`Fetching WB ${orderType} statuses for ${uniqueIds.length} ids`);
    const headers = {
      'Authorization': apiKey,
      'Content-Type': 'application/json'
    };

    // 1) основной вариант: массив строк
    try {
      const resp = await axios.post(`${base}${path}`, { orders: uniqueIds.map(String) }, { headers });
      return resp.data?.orders || [];
    } catch (e1) {
      const body = e1.response?.data;
      if (!body || body.code !== 'IncorrectRequestBody') throw e1;
      // 2) попытка: массив чисел (если ids числовые)
      const numericIds = uniqueIds.map(id => {
        const n = Number(id);
        return Number.isFinite(n) ? n : id; // оставим строки, если не число
      });
      try {
        const resp2 = await axios.post(`${base}${path}`, { orders: numericIds }, { headers });
        return resp2.data?.orders || [];
      } catch (e2) {
        const body2 = e2.response?.data;
        if (!body2 || body2.code !== 'IncorrectRequestBody') throw e2;
        // 3) попытка: массив объектов { id }
        const resp3 = await axios.post(`${base}${path}`, { orders: uniqueIds.map(id => ({ id })) }, { headers });
        return resp3.data?.orders || [];
      }
    }
  } catch (err) {
    console.error(`Wildberries ${orderType} statuses API error:`, err.response?.data || err.message);
    return [];
  }
}

// Получение сборочных заданий (assignments) по типу: FBS/DBW/DBS
// Возвращает массив объектов, стараясь включать идентификаторы для последующего сопоставления
async function fetchWildberriesAssignmentsByType(apiKey, orderType) {
  const base = 'https://marketplace-api.wildberries.ru/api/v3';
  let pathList = ['/orders']; // основной список
  if (orderType === 'DBW') pathList = ['/dbw/orders'];
  if (orderType === 'DBS') pathList = ['/dbs/orders'];

  const headers = { 'Authorization': apiKey };

  // Пытаемся получить как текущие задания, так и новые (fallback)
  const tryPaths = [...pathList, ...pathList.map(p => p.replace('/orders', '/orders/new'))];

  for (const path of tryPaths) {
    try {
      const resp = await axios.get(`${base}${path}`, { headers });
      const data = resp.data;
      // Унифицируем структуру к массиву объектов с возможными полями id, gNumber, srid
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.orders)) return data.orders;
      if (data && Array.isArray(data.data)) return data.data;
    } catch (e) {
      // продолжаем к следующему пути
    }
  }
  return [];
}

async function fetchWildberriesOrders(apiKey, period = 'week') {
  try {
    console.log('Fetching Wildberries orders...');
    
    // Вычисляем даты в зависимости от выбранного периода
    let dateFrom, dateTo;
    const now = new Date();
    
    switch (period) {
      case 'today':
        dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split('T')[0];
        dateTo = now.toISOString().split('T')[0];
        break;
      case 'week':
        dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        dateTo = now.toISOString().split('T')[0];
        break;
      case 'month':
        dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        dateTo = now.toISOString().split('T')[0];
        break;
      default:
        dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        dateTo = now.toISOString().split('T')[0];
    }
    
    console.log(`Date range: ${dateFrom} to ${dateTo}`);
    
    const response = await axios.get('https://statistics-api.wildberries.ru/api/v1/supplier/orders', {
      headers: {
        'Authorization': apiKey
      },
      params: {
        dateFrom,
        dateTo
      }
    });

    console.log('Wildberries API response:', response.data);

    let orders = [];
    if (response.data && Array.isArray(response.data)) {
      orders = response.data;
    } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
      orders = response.data.data;
    }

    console.log(`Found ${orders.length} orders`);

    // Получаем статусы сборочных заданий: сначала пытаемся подтянуть реальные ID заданий через WB API
    // 1) Определяем тип по каждому заказу
    const determineType = (o) => {
      if (o.isFBS !== undefined) return o.isFBS ? 'FBS' : 'DBW';
      if (o.deliveryType) {
        switch (o.deliveryType) {
          case 'fbs': return 'FBS';
          case 'dbw': return 'DBW';
          case 'dbs': return 'DBS';
        }
      }
      if (o.warehouseType && typeof o.warehouseType === 'string') {
        if (o.warehouseType.toLowerCase().includes('продав')) return 'FBS';
        if (o.warehouseType.toLowerCase().includes('wb')) return 'DBW';
      }
      return 'FBS';
    };

    const assignmentsByType = await Promise.all([
      fetchWildberriesAssignmentsByType(apiKey, 'FBS'),
      fetchWildberriesAssignmentsByType(apiKey, 'DBW'),
      fetchWildberriesAssignmentsByType(apiKey, 'DBS')
    ]);
    const [fbsAssignments, dbwAssignments, dbsAssignments] = assignmentsByType;

    // Формируем быстрые карты для сопоставления
    const mapBy = (arr, keyFields) => {
      const m = new Map();
      for (const it of arr || []) {
        const keys = [];
        for (const k of keyFields) if (it[k]) keys.push(String(it[k]));
        const id = it.id || it.orderId || it.orderID || it.order_id || it.uid || it.orderUid || it.gNumber || it.srid;
        if (!id) continue;
        for (const k of keys) m.set(k, String(id));
      }
      return m;
    };

    const fbsMap = mapBy(fbsAssignments, ['gNumber', 'srid']);
    const dbwMap = mapBy(dbwAssignments, ['gNumber', 'srid']);
    const dbsMap = mapBy(dbsAssignments, ['gNumber', 'srid']);

    // 2) Сопоставляем нашим заказам WB id сборочных заданий
    const fbsIds = [];
    const dbwIds = [];
    const dbsIds = [];
    for (const o of orders) {
      const type = determineType(o);
      const candidateKeys = [o.gNumber, o.srid].filter(Boolean).map(String);
      let assignmentId;
      if (type === 'FBS') {
        for (const k of candidateKeys) { assignmentId = fbsMap.get(k); if (assignmentId) break; }
      } else if (type === 'DBW') {
        for (const k of candidateKeys) { assignmentId = dbwMap.get(k); if (assignmentId) break; }
      } else if (type === 'DBS') {
        for (const k of candidateKeys) { assignmentId = dbsMap.get(k); if (assignmentId) break; }
      }
      if (assignmentId) {
        if (type === 'FBS') fbsIds.push(assignmentId);
        if (type === 'DBW') dbwIds.push(assignmentId);
        if (type === 'DBS') dbsIds.push(assignmentId);
      }
    }

    const [fbsStatuses, dbwStatuses, dbsStatuses] = await Promise.all([
      fetchWildberriesOrderStatusesByType(apiKey, fbsIds, 'FBS'),
      fetchWildberriesOrderStatusesByType(apiKey, dbwIds, 'DBW'),
      fetchWildberriesOrderStatusesByType(apiKey, dbsIds, 'DBS')
    ]);

    const orderStatuses = [...fbsStatuses, ...dbwStatuses, ...dbsStatuses];

    // Создаем мапу статусов для быстрого поиска
    const statusMap = new Map();
    orderStatuses.forEach(status => {
      statusMap.set(status.id, status);
    });

    return orders.map(order => {
      // Правильно обрабатываем дату из Wildberries API (Unix timestamp в миллисекундах)
      let orderDate;
      if (order.date) {
        // Если дата в формате Unix timestamp (миллисекунды)
        if (typeof order.date === 'number') {
          orderDate = new Date(order.date);
        } else {
          // Если дата в формате строки
          orderDate = new Date(order.date);
        }
      } else {
        orderDate = new Date();
      }
      
      const formattedDate = orderDate.toISOString();
      
      // Определяем тип заказа на основе данных
      let orderType = 'FBS'; // По умолчанию
      
      // Логика определения типа заказа на основе полей ответа
      if (order.isFBS !== undefined) {
        orderType = order.isFBS ? 'FBS' : 'DBW';
      } else if (order.deliveryType) {
        switch (order.deliveryType) {
          case 'fbs':
            orderType = 'FBS';
            break;
          case 'dbw':
            orderType = 'DBW';
            break;
          case 'dbs':
            orderType = 'DBS';
            break;
        }
      }

      // Определяем статус заказа на основе данных Wildberries API
      let status = 'new';
      const orderId = order.gNumber || order.srid;
      const orderStatus = statusMap.get(orderId);
      
      // Если заказ старше 3 дней и не найден в активных сборочных заданиях - считаем завершенным
      const daysSinceOrder = (Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceOrder > 3 && !orderStatus && !order.isCancel) {
        status = 'delivered'; // Старые заказы считаем доставленными
      } else if (order.isCancel) {
        status = 'cancelled';
      } else if (orderStatus) {
        // Используем данные из API статусов сборочных заданий
        const supplierStatus = orderStatus.supplierStatus;
        const wbStatus = orderStatus.wbStatus;
        
        // Маппинг supplierStatus на наши статусы
        switch (supplierStatus) {
          case 'new':
            status = 'new';
            break;
          case 'confirm':
            status = 'in_assembly';
            break;
          case 'complete':
            status = 'shipped';
            break;
          case 'cancel':
            status = 'cancelled';
            break;
          default:
            status = 'new';
        }
        
        // Дополнительная проверка wbStatus для уточнения
        if (wbStatus === 'sold') {
          status = 'delivered';
        } else if (wbStatus === 'canceled' || wbStatus === 'canceled_by_client' || wbStatus === 'declined_by_client') {
          status = 'cancelled';
        } else if (wbStatus === 'ready_for_pickup') {
          status = 'shipped';
        }
      } else if (order.isRealization && order.warehouseType === 'Склад продавца') {
        status = 'in_assembly'; // Заказ на сборке
      } else if (order.isRealization && order.warehouseType === 'Склад WB') {
        status = 'shipped'; // Заказ отправлен
      } else if (order.isRealization && order.warehouseType === 'Склад WB (доставка)') {
        status = 'delivered'; // Заказ доставлен
      } else if (order.status) {
        // Маппинг статусов Wildberries на наши
        const statusMap = {
          'new': 'new',
          'confirm': 'in_assembly',
          'cancel': 'cancelled',
          'delivered': 'delivered',
          'shipped': 'shipped'
        };
        status = statusMap[order.status] || 'new';
      }
      
      return {
        orderId: order.gNumber || order.srid || order.nmId?.toString() || 'unknown',
        totalAmount: order.finishedPrice || order.priceWithDisc || order.totalPrice || 0,
        customerName: 'Клиент Wildberries',
        customerPhone: '',
        customerEmail: '',
        deliveryAddress: `${order.regionName || ''}, ${order.oblastOkrugName || ''}`.replace(/^,\s*|,\s*$/g, '') || 'Не указан',
        status: status,
        marketplace: 'wildberries',
        orderType: orderType,
        orderDate: formattedDate,
        // Дополнительная информация о статусах
        supplierStatus: orderStatus?.supplierStatus || null,
        wbStatus: orderStatus?.wbStatus || null,
        items: [{
          article: order.supplierArticle || order.nmId?.toString() || 'unknown',
          name: `${order.subject || ''} ${order.brand ? `(${order.brand})` : ''}`.trim() || 'Товар',
          quantity: 1,
          price: order.finishedPrice || order.priceWithDisc || 0,
          totalPrice: order.finishedPrice || order.priceWithDisc || 0
        }]
      };
    });

  } catch (err) {
    console.error('Wildberries API error:', err.response?.data || err.message);
    return [];
  }
}

async function fetchOzonOrders(apiKey, clientId) {
  try {
    const response = await axios.post('https://api-seller.ozon.ru/v3/posting/list', {
      filter: {
        since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        to: new Date().toISOString()
      },
      limit: 100
    }, {
      headers: {
        'Client-Id': clientId,
        'Api-Key': apiKey
      }
    });

    return response.data.result.postings.map(posting => ({
      orderId: posting.order_id.toString(),
      totalAmount: posting.total_price || 0,
      customerName: posting.customer?.name || 'Не указано',
      customerPhone: posting.customer?.phone || '',
      customerEmail: posting.customer?.email || '',
      deliveryAddress: posting.delivery_method?.warehouse?.address || 'Не указан',
      status: posting.status || 'new',
      marketplace: 'ozon',
      items: posting.products.map(product => ({
        article: product.offer_id,
        name: product.name,
        quantity: product.quantity,
        price: product.price,
        totalPrice: product.price * product.quantity
      }))
    }));
  } catch (err) {
    console.error('Ozon API error:', err);
    return [];
  }
}

async function fetchYandexMarketOrders(apiKey) {
  try {
    const response = await axios.get('https://api.partner.market.yandex.ru/v2/campaigns/orders', {
      headers: {
        'Authorization': `OAuth ${apiKey}`
      },
      params: {
        fromDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        toDate: new Date().toISOString(),
        pageSize: 100
      }
    });

    return response.data.orders.map(order => ({
      orderId: order.id.toString(),
      totalAmount: order.totalPrice || 0,
      customerName: order.customer?.name || 'Не указано',
      customerPhone: order.customer?.phone || '',
      customerEmail: order.customer?.email || '',
      deliveryAddress: order.delivery?.address || 'Не указан',
      status: order.status || 'new',
      marketplace: 'yandex_market',
      items: order.items.map(item => ({
        article: item.offerId,
        name: item.name,
        quantity: item.count,
        price: item.price,
        totalPrice: item.price * item.count
      }))
    }));
  } catch (err) {
    console.error('Yandex Market API error:', err);
    return [];
  }
}

// Обогащение: новые сборочные задания WB + описание + статусы (FBS/DBW/DBS)
async function fetchEnrichedWbNewAssignments(apiKey) {
  const types = ['FBS', 'DBW', 'DBS'];
  const resultsByType = await Promise.all(types.map(async (t) => {
    // получаем задания для типа (функция внутри пытается и /orders, и /orders/new)
    const assignments = await fetchWildberriesAssignmentsByType(apiKey, t);
    if (!assignments || assignments.length === 0) return [];

    // собираем возможные идентификаторы для статусов
    const ids = [];
    for (const a of assignments) {
      const id = a.id || a.orderId || a.orderID || a.order_id || a.uid || a.orderUid;
      if (id) ids.push(String(id));
    }

    const statuses = await fetchWildberriesOrderStatusesByType(apiKey, ids, t);
    const statusMap = new Map();
    for (const s of statuses || []) {
      statusMap.set(String(s.id), s);
    }

    // собираем nmId для доп.описания из статистики (subject/brand/article)
    const nmIds = [];
    for (const a of assignments) {
      if (a.nmId) nmIds.push(Number(a.nmId));
    }
    const metaByNm = await fetchWbProductMetaByNmIds(apiKey, nmIds);

    // нормализация описания
    const normalize = (a) => {
      const id = String(a.id || a.orderId || a.orderID || a.order_id || a.uid || a.orderUid || a.gNumber || a.srid || '');
      const st = statusMap.get(id);
      // поля описания из задания, если есть
      const meta = a.nmId ? metaByNm.get(Number(a.nmId)) : undefined;
      const subject = a.subject || a.subjectName || a.category || meta?.subject || '';
      const brand = a.brand || a.vendor || meta?.brand || '';
      const name = a.name || a.title || meta?.name || (subject ? `${subject}${brand ? ` (${brand})` : ''}` : 'Товар');
      const quantity = a.quantity || a.qty || 1;
      const price = a.finishedPrice || a.priceWithDisc || a.price || 0;
      const totalPrice = typeof a.totalPrice === 'number' ? a.totalPrice : (price * quantity);
      const deliveryAddress = a.deliveryAddress?.address || a.address || a.regionName || '';
      const createdAt = a.createdAt || a.date || a.created || a.createDt || null;
      const orderDate = createdAt ? new Date(createdAt).toISOString() : new Date().toISOString();

      // маппинг supplierStatus -> наш статус
      let status = 'new';
      if (st) {
        const supplierStatus = st.supplierStatus;
        const wbStatus = st.wbStatus;
        switch (supplierStatus) {
          case 'new': status = 'new'; break;
          case 'confirm': status = 'in_assembly'; break;
          case 'complete': status = 'shipped'; break;
          case 'cancel': status = 'cancelled'; break;
          default: status = 'new';
        }
        if (wbStatus === 'sold') status = 'delivered';
        if (wbStatus === 'ready_for_pickup') status = 'shipped';
        if (wbStatus === 'canceled' || wbStatus === 'canceled_by_client' || wbStatus === 'declined_by_client') status = 'cancelled';
      } else if (a.status) {
        const statusMapLocal = { new: 'new', confirm: 'in_assembly', complete: 'shipped', cancel: 'cancelled' };
        status = statusMapLocal[a.status] || 'new';
      }

      return {
        id,
        gNumber: a.gNumber || null,
        srid: a.srid || null,
        marketplace: 'wildberries',
        orderType: t,
        orderDate,
        status,
        supplierStatus: st?.supplierStatus || null,
        wbStatus: st?.wbStatus || null,
        items: [{
          article: a.supplierArticle || meta?.supplierArticle || a.nmId?.toString() || 'unknown',
          name,
          quantity,
          price,
          totalPrice
        }],
        deliveryAddress: deliveryAddress || 'Не указан'
      };
    };

    return assignments.map(normalize);
  }));

  return resultsByType.flat();
}

// Доп.мета по товарам из статистики (subject/brand/supplierArticle) по nmId
async function fetchWbProductMetaByNmIds(apiKey, nmIds) {
  const map = new Map();
  if (!nmIds || nmIds.length === 0) return map;
  try {
    const unique = Array.from(new Set(nmIds.filter(n => Number.isFinite(n))));
    if (unique.length === 0) return map;

    // Берём небольшой период, чтобы ответ был компактным
    const now = new Date();
    const dateTo = now.toISOString().split('T')[0];
    const dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const resp = await axios.get('https://statistics-api.wildberries.ru/api/v1/supplier/orders', {
      headers: { 'Authorization': apiKey },
      params: { dateFrom, dateTo }
    });
    const rows = Array.isArray(resp.data) ? resp.data : (resp.data?.data || []);
    for (const r of rows) {
      const nm = Number(r.nmId || r.nmid || r.nmID);
      if (!Number.isFinite(nm)) continue;
      if (!unique.includes(nm)) continue;
      if (!map.has(nm)) {
        map.set(nm, {
          name: r.subject && r.brand ? `${r.subject} (${r.brand})` : (r.subject || r.brand || undefined),
          subject: r.subject || undefined,
          brand: r.brand || undefined,
          supplierArticle: r.supplierArticle || r.article || undefined
        });
      }
    }
  } catch (e) {
    // тихо продолжим без меты
  }
  return map;
}

// Эндпоинт: новые сборочные задания WB (обогащённые описанием и статусами)
router.get('/wb/assignments/new', requireClient, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const r = await client.query('SELECT api_keys FROM clients WHERE user_id = $1', [req.user.id]);
      if (r.rows.length === 0) return res.status(404).json({ error: 'Client not found' });
      const wbKey = r.rows[0].api_keys?.wildberries?.api_key;
      if (!wbKey) return res.status(400).json({ error: 'Wildberries API key not configured' });

      const data = await fetchEnrichedWbNewAssignments(wbKey);
      res.json({ assignments: data });
    } finally {
      client.release();
    }
  } catch (e) {
    console.error('WB enriched assignments error:', e.response?.data || e.message);
    res.status(500).json({ error: 'Failed to fetch WB assignments' });
  }
});

// Эндпоинт: «новые заказы» WB за текущий день через Statistics API
router.get('/wb/orders/today', requireClient, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const r = await client.query('SELECT api_keys FROM clients WHERE user_id = $1', [req.user.id]);
      if (r.rows.length === 0) return res.status(404).json({ error: 'Client not found' });
      const wbKey = r.rows[0].api_keys?.wildberries?.api_key;
      if (!wbKey) return res.status(400).json({ error: 'Wildberries API key not configured' });

      // используем уже существующую нормализацию и обогащение на базе Statistics API
      const orders = await fetchWildberriesOrders(wbKey, 'today');
      res.json({ orders });
    } finally {
      client.release();
    }
  } catch (e) {
    console.error('WB today orders error:', e.response?.data || e.message);
    res.status(500).json({ error: 'Failed to fetch today WB orders' });
  }
});

// ===== ТОВАРЫ МАГАЗИНА =====

// Получение списка карточек товаров для текущего клиента
router.get('/store-products', requireClient, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      // Получаем client_id
      const clientResult = await client.query(
        `SELECT id FROM clients WHERE user_id = $1`,
        [req.user.id]
      );

      if (clientResult.rows.length === 0) {
        return res.status(404).json({ error: 'Клиент не найден' });
      }

      const clientId = clientResult.rows[0].id;

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
router.post('/store-products/load', requireClient, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      // Получаем client_id и API ключи
      const clientResult = await client.query(
        `SELECT id, api_keys, user_id FROM clients WHERE user_id = $1`,
        [req.user.id]
      );

      if (clientResult.rows.length === 0) {
        return res.status(404).json({ error: 'Клиент не найден' });
      }

      const clientId = clientResult.rows[0].id;
      const apiKeys = clientResult.rows[0].api_keys || {};
      const wildberriesKey = apiKeys.wildberries?.api_key;

      if (!wildberriesKey) {
        return res.status(400).json({ 
          error: 'API ключ Wildberries не настроен',
          details: 'Необходимо настроить API ключ в настройках'
        });
      }

      // Используем существующий сервис для получения товаров
      const WildberriesPricingService = require('../services/wildberriesPricingService');
      const wbService = new WildberriesPricingService();
      
      const products = await wbService.fetchSupplierProducts(wildberriesKey, req.user.id);

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

// Получение товаров СИМА ЛЕНД
router.get('/sima-land/products', requireClient, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      // Получаем client_id и API ключи
      const clientResult = await client.query(
        `SELECT id, api_keys, user_id FROM clients WHERE user_id = $1`,
        [req.user.id]
      );

      if (clientResult.rows.length === 0) {
        return res.status(404).json({ error: 'Клиент не найден' });
      }

      const clientId = clientResult.rows[0].id;
      const apiKeys = clientResult.rows[0].api_keys || {};
      const simaLandToken = apiKeys.sima_land?.token;

      if (!simaLandToken) {
        return res.status(400).json({ 
          error: 'Токен API СИМА ЛЕНД не настроен',
          details: 'Необходимо настроить токен API в настройках'
        });
      }

      // Поиск по названию/артикулу и фильтрация по категориям
      const search = (req.query.search || '').toString().trim();
      const categoryIds = req.query.categories 
        ? (Array.isArray(req.query.categories) ? req.query.categories : [req.query.categories])
            .map(id => parseInt(id))
            .filter(id => !isNaN(id))
        : [];

      let productsResult;
      if (!search && categoryIds.length === 0) {
        // Если нет ни поиска, ни категорий — вернем пустой список
        productsResult = { rows: [] };
      } else {
        let query = `SELECT id, article, name, brand, category, category_id, purchase_price, available_quantity, image_url, description
                     FROM sima_land_catalog
                     WHERE 1=1`;
        const params = [];
        let paramIndex = 1;

        // Фильтрация по поиску
        if (search) {
          const like = `%${search}%`;
          query += ` AND (name ILIKE $${paramIndex} OR article ILIKE $${paramIndex})`;
          params.push(like);
          paramIndex++;
        }

        // Фильтрация по категориям
        // Используем двойную фильтрацию: по category_id И по названию категории
        // Это нужно, потому что товары могут иметь category_id, который не совпадает с ID в таблице категорий
        // или товары могут иметь только текстовое название категории без category_id
        if (categoryIds.length > 0) {
          // Получаем названия категорий по их ID из таблицы категорий
          const catNamesResult = await client.query(
            `SELECT id, name FROM sima_land_categories WHERE id = ANY($1)`,
            [categoryIds]
          );
          let categoryNames = catNamesResult.rows.map(cat => cat.name);
          
          // Если категории не найдены в таблице, возможно это текстовые категории с временными ID
          // В этом случае нужно попробовать найти категории по названию из каталога
          // Временные ID создаются на основе хэша названия, поэтому можно попробовать восстановить
          if (categoryNames.length === 0) {
            // Получаем все уникальные категории из каталога
            const textCatsResult = await client.query(
              `SELECT DISTINCT category FROM sima_land_catalog 
               WHERE category IS NOT NULL AND category != ''`
            );
            
            // Пробуем найти соответствие: вычисляем хэш для каждой категории и сравниваем с запрошенными ID
            for (const textCat of textCatsResult.rows) {
              if (textCat.category) {
                const hashId = Math.abs(textCat.category.split('').reduce((a, b) => {
                  a = ((a << 5) - a) + b.charCodeAt(0);
                  return a & a;
                }, 0));
                // Если хэш совпадает с одним из запрошенных ID, используем эту категорию
                if (categoryIds.includes(hashId)) {
                  categoryNames.push(textCat.category);
                }
              }
            }
          }
          
          // Если у нас есть названия категорий, фильтруем по ним
          if (categoryNames.length > 0) {
            query += ` AND (`;
            
            // Фильтрация по category_id (точное совпадение)
            query += `category_id = ANY($${paramIndex})`;
            params.push(categoryIds);
            paramIndex++;
            
            // ИЛИ фильтрация по названию категории (на случай, если category_id NULL или не совпадает)
            query += ` OR (`;
            const categoryNameConditions = [];
            for (const catName of categoryNames) {
              if (catName && catName.trim()) {
                categoryNameConditions.push(`LOWER(TRIM(category)) = LOWER(TRIM($${paramIndex}))`);
                params.push(catName.trim());
                paramIndex++;
              }
            }
            if (categoryNameConditions.length > 0) {
              query += categoryNameConditions.join(' OR ');
            } else {
              query += '1=0'; // false condition
            }
            query += `)`;
            
            query += `)`;
          } else {
            // Если категорий не найдено, фильтруем только по ID
            query += ` AND category_id = ANY($${paramIndex})`;
            params.push(categoryIds);
            paramIndex++;
          }
        }

        query += ` ORDER BY created_at DESC LIMIT 1000`;
        
        productsResult = await client.query(query, params);
      }

      res.json({
        success: true,
        products: productsResult.rows
      });

    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get sima-land products error:', err);
    res.status(500).json({ error: 'Ошибка получения товаров СИМА ЛЕНД' });
  }
});

// Загрузка товаров СИМА ЛЕНД
router.post('/sima-land/products/load', requireClient, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      // Получаем client_id и API ключи
      const clientResult = await client.query(
        `SELECT id, api_keys, user_id FROM clients WHERE user_id = $1`,
        [req.user.id]
      );

      if (clientResult.rows.length === 0) {
        return res.status(404).json({ error: 'Клиент не найден' });
      }

      const clientId = clientResult.rows[0].id;
      const apiKeys = clientResult.rows[0].api_keys || {};
      const simaLandToken = apiKeys.sima_land?.token;

      if (!simaLandToken) {
        return res.status(400).json({ 
          error: 'Токен API СИМА ЛЕНД не настроен',
          details: 'Необходимо настроить токен API в настройках'
        });
      }

      // Если у клиента уже идёт импорт — вернём существующий jobId
      const progressStore = require('../services/progressStore');
      const running = progressStore.getRunningImportJobByClient(clientId);
      if (running) {
        return res.status(202).json({ success: true, jobId: running.id, alreadyRunning: true });
      }

      // Создаём фоновую задачу и возвращаем jobId
      const categories = Array.isArray(req.body?.categories) ? req.body.categories.filter(Boolean) : [];
      const jobId = progressStore.createJob('simaLandImport', { clientId, categories });

      // Запускаем фоновую загрузку без ожидания результата
      const SimaLandService = require('../services/simaLandService');
      const simaLandService = new SimaLandService();
      simaLandService.loadProductsForClient(clientId, simaLandToken, jobId, { categories })
        .catch(err => {
          console.error('Sima-land import failed:', err);
          progressStore.failJob(jobId, err.message);
        });

      return res.status(202).json({ success: true, jobId });

    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Load sima-land products error:', err);
    res.status(500).json({ error: 'Ошибка запуска загрузки товаров СИМА ЛЕНД' });
  }
});

// Статус фоновой задачи загрузки товаров СИМА ЛЕНД
router.get('/sima-land/products/status', requireClient, async (req, res) => {
  const { jobId } = req.query;
  if (!jobId) return res.status(400).json({ error: 'jobId обязателен' });
  const progressStore = require('../services/progressStore');
  const job = progressStore.getJob(String(jobId));
  if (!job) return res.status(404).json({ error: 'Задача не найдена' });
  return res.json(job);
});

// Категории СИМА ЛЕНД
router.get('/sima-land/categories', requireClient, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      // Проверяем параметр обновления категорий из API
      const refreshFromApi = req.query.refresh === 'true';
      
      // Если запрошено обновление, загружаем категории из API
      if (refreshFromApi) {
        const clientResult = await client.query(
          `SELECT api_keys FROM clients WHERE user_id = $1`,
          [req.user.id]
        );

        if (clientResult.rows.length > 0) {
          const apiKeys = clientResult.rows[0].api_keys || {};
          const simaLandToken = apiKeys.sima_land?.token;

          if (simaLandToken) {
            try {
              const SimaLandService = require('../services/simaLandService');
              const simaLandService = new SimaLandService();
              
              // Загружаем категории из API согласно документации v3
              const apiCategories = await simaLandService.fetchCategories(simaLandToken, { perPage: 1000 });
              
              // Сохраняем категории в БД
              for (const cat of apiCategories) {
                try {
                  await client.query(
                    `INSERT INTO sima_land_categories (id, name, parent_id, level)
                     VALUES ($1,$2,$3,$4)
                     ON CONFLICT (id) DO UPDATE SET 
                       name=EXCLUDED.name, 
                       parent_id=EXCLUDED.parent_id, 
                       level=EXCLUDED.level, 
                       updated_at=NOW()`,
                    [cat.id, cat.name, cat.parent_id || null, cat.depth || null]
                  );
                } catch (err) {
                  console.warn(`Failed to save category ${cat.id}:`, err.message);
                }
              }
              
              console.log(`✅ Обновлено ${apiCategories.length} категорий из API`);
            } catch (apiError) {
              console.error('Error refreshing categories from API:', apiError);
              // Продолжаем с данными из БД
            }
          }
        }
      }

      // Получаем категории из БД
      let cats = await client.query(
        `SELECT id, name, parent_id, level FROM sima_land_categories ORDER BY name`
      );
      
      if (cats.rows.length === 0) {
        // Резервно соберём категории из каталога
        cats = await client.query(
          `SELECT DISTINCT category_id AS id, COALESCE(category,'Без категории') AS name, NULL::BIGINT AS parent_id, NULL::INT AS level
           FROM sima_land_catalog
           WHERE category_id IS NOT NULL
           ORDER BY name`
        );
      }
      
      // Также добавляем категории из текстового поля category, если они отсутствуют
      // Это нужно для случаев, когда category_id NULL, но есть текстовое название
      const textCats = await client.query(
        `SELECT DISTINCT category AS name, COUNT(*) as product_count
         FROM sima_land_catalog
         WHERE category IS NOT NULL AND category != ''
         GROUP BY category
         ORDER BY category`
      );
      
      // Объединяем категории: из таблицы категорий + уникальные из текстового поля
      const categoryMap = new Map();
      cats.rows.forEach(cat => {
        categoryMap.set(cat.id, cat);
      });
      
      // Добавляем уникальные текстовые категории, которых нет в списке
      textCats.rows.forEach(textCat => {
        const found = Array.from(categoryMap.values()).find(c => 
          c.name && c.name.toLowerCase() === textCat.name.toLowerCase()
        );
        if (!found) {
          // Создаем временный ID на основе хэша названия для текстовых категорий без ID
          const tempId = Math.abs(textCat.name.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
          }, 0));
          // Проверяем, нет ли уже такого ID
          if (!categoryMap.has(tempId)) {
            categoryMap.set(tempId, {
              id: tempId,
              name: textCat.name,
              parent_id: null,
              level: null,
              product_count: parseInt(textCat.product_count)
            });
          }
        }
      });
      
      return res.json({ 
        categories: Array.from(categoryMap.values()),
        total: categoryMap.size,
        refreshed: refreshFromApi
      });
    } finally {
      client.release();
    }
  } catch (e) {
    console.error('Get categories error:', e);
    res.status(500).json({ error: 'Ошибка получения категорий' });
  }
});

// Обновление общего каталога (админ/скрипт)
router.post('/sima-land/catalog/load', async (req, res) => {
  try {
    // Проверка статического токена для защиты эндпоинта
    const staticHeader = req.headers['x-static-token'];
    const staticToken = process.env.SIMA_LAND_STATIC_TOKEN;
    if (!staticToken || staticHeader !== staticToken) {
      return res.status(401).json({ error: 'Invalid static token' });
    }

    console.log('🔐 Catalog load requested', { categories: req.body?.categories });
    const progressStore = require('../services/progressStore');
    const jobId = progressStore.createJob('simaLandCatalogLoad', { categories: req.body?.categories || [] });
    const SimaLandService = require('../services/simaLandService');
    const simaLandService = new SimaLandService();
    simaLandService.loadCatalog({ categories: Array.isArray(req.body?.categories) ? req.body.categories : [] }, jobId).catch(err => {
      console.error('Catalog load failed:', err);
      progressStore.failJob(jobId, err.message);
    });
    res.status(202).json({ success: true, jobId });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка запуска загрузки каталога' });
  }
});

// Добавление товара СИМА ЛЕНД в каталог клиента и в товары магазина
router.post('/sima-land/products/add', requireClient, async (req, res) => {
  try {
    const { article, name, brand, category, purchase_price, available_quantity, image_url, description } = req.body;

    if (!article || !name) {
      return res.status(400).json({ error: 'Артикул и название обязательны' });
    }

    const client = await pool.connect();
    try {
      // Получаем client_id
      const clientResult = await client.query(
        `SELECT id FROM clients WHERE user_id = $1`,
        [req.user.id]
      );

      if (clientResult.rows.length === 0) {
        return res.status(404).json({ error: 'Клиент не найден' });
      }

      const clientId = clientResult.rows[0].id;

      // Добавляем товар в каталог клиента (sima_land_products)
      const SimaLandService = require('../services/simaLandService');
      const simaLandService = new SimaLandService();
      
      const productId = await simaLandService.addClientProduct(clientId, {
        article,
        name,
        brand,
        category,
        purchase_price,
        available_quantity,
        image_url,
        description
      });

      // Добавляем товар в товары магазина (wb_products_cache)
      // Проверяем, существует ли уже товар с таким артикулом
      const existingStoreProduct = await client.query(
        `SELECT id FROM wb_products_cache 
         WHERE client_id = $1 AND article = $2 AND source = 'sima_land'`,
        [clientId, article]
      );

      if (existingStoreProduct.rows.length > 0) {
        // Обновляем существующий товар
        await client.query(
          `UPDATE wb_products_cache 
           SET name = $3, brand = $4, category = $5, purchase_price = $6, 
               available_quantity = $7, image_url = $8, description = $9,
               last_updated = NOW()
           WHERE client_id = $1 AND article = $2 AND source = 'sima_land'`,
          [
            clientId,
            article,
            name,
            brand,
            category,
            purchase_price || 0,
            available_quantity || 0,
            image_url,
            description
          ]
        );
      } else {
        // Создаем новый товар в магазине
        // Используем ON CONFLICT по уникальному индексу (client_id, article, source)
        await client.query(
          `INSERT INTO wb_products_cache 
           (client_id, article, name, brand, category, purchase_price, available_quantity, 
            image_url, description, source, is_active, marketplace_targets, markup_percent, nm_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'sima_land', true, '[]'::jsonb, 0.00, NULL)
           ON CONFLICT (client_id, article, source) DO UPDATE SET
             name = EXCLUDED.name,
             brand = EXCLUDED.brand,
             category = EXCLUDED.category,
             purchase_price = EXCLUDED.purchase_price,
             available_quantity = EXCLUDED.available_quantity,
             image_url = EXCLUDED.image_url,
             description = EXCLUDED.description,
             last_updated = NOW()`,
          [
            clientId,
            article,
            name,
            brand,
            category,
            purchase_price || 0,
            available_quantity || 0,
            image_url,
            description
          ]
        );
      }

      res.json({
        success: true,
        message: 'Товар успешно добавлен в магазин',
        productId
      });

    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Add sima-land product error:', err);
    res.status(500).json({ error: 'Ошибка добавления товара' });
  }
});

// Обновление наценки товара
router.put('/store-products/:productId/markup', requireClient, async (req, res) => {
  try {
    const { productId } = req.params;
    const { markup_percent } = req.body;

    if (markup_percent === undefined || markup_percent === null) {
      return res.status(400).json({ error: 'Наценка обязательна' });
    }

    const markupValue = parseFloat(markup_percent);
    if (isNaN(markupValue) || markupValue < 0) {
      return res.status(400).json({ error: 'Наценка должна быть неотрицательным числом' });
    }

    const client = await pool.connect();
    try {
      // Получаем client_id
      const clientResult = await client.query(
        `SELECT id FROM clients WHERE user_id = $1`,
        [req.user.id]
      );

      if (clientResult.rows.length === 0) {
        return res.status(404).json({ error: 'Клиент не найден' });
      }

      const clientId = clientResult.rows[0].id;

      // Обновляем наценку товара
      const updateResult = await client.query(
        `UPDATE wb_products_cache 
         SET markup_percent = $1, last_updated = NOW()
         WHERE id = $2 AND client_id = $3
         RETURNING *`,
        [markupValue, productId, clientId]
      );

      if (updateResult.rows.length === 0) {
        return res.status(404).json({ error: 'Товар не найден' });
      }

      res.json({
        success: true,
        product: updateResult.rows[0]
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update markup error:', err);
    res.status(500).json({ error: 'Ошибка обновления наценки' });
  }
});

// Обновление списка маркетплейсов для товара
router.put('/store-products/:productId/marketplaces', requireClient, async (req, res) => {
  try {
    const { productId } = req.params;
    const { marketplace_targets } = req.body;

    if (!Array.isArray(marketplace_targets)) {
      return res.status(400).json({ error: 'marketplace_targets должен быть массивом' });
    }

    // Проверяем, что все значения валидны
    const validMarketplaces = ['wb', 'ozon', 'yandex_market'];
    const invalid = marketplace_targets.filter(m => !validMarketplaces.includes(m));
    if (invalid.length > 0) {
      return res.status(400).json({ 
        error: `Недопустимые маркетплейсы: ${invalid.join(', ')}. Допустимые: ${validMarketplaces.join(', ')}` 
      });
    }

    const client = await pool.connect();
    try {
      // Получаем client_id
      const clientResult = await client.query(
        `SELECT id FROM clients WHERE user_id = $1`,
        [req.user.id]
      );

      if (clientResult.rows.length === 0) {
        return res.status(404).json({ error: 'Клиент не найден' });
      }

      const clientId = clientResult.rows[0].id;

      // Обновляем список маркетплейсов
      const updateResult = await client.query(
        `UPDATE wb_products_cache 
         SET marketplace_targets = $1::jsonb, last_updated = NOW()
         WHERE id = $2 AND client_id = $3
         RETURNING *`,
        [JSON.stringify(marketplace_targets), productId, clientId]
      );

      if (updateResult.rows.length === 0) {
        return res.status(404).json({ error: 'Товар не найден' });
      }

      res.json({
        success: true,
        product: updateResult.rows[0]
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update marketplaces error:', err);
    res.status(500).json({ error: 'Ошибка обновления маркетплейсов' });
  }
});

// Загрузка товара на Яндекс Маркет
router.post('/store-products/:productId/upload/yandex-market', requireClient, async (req, res) => {
  try {
    const { productId } = req.params;
    const { marketCategoryId, businessId, parameterValues } = req.body;

    const client = await pool.connect();
    try {
      // Получаем client_id
      const clientResult = await client.query(
        `SELECT id FROM clients WHERE user_id = $1`,
        [req.user.id]
      );

      if (clientResult.rows.length === 0) {
        return res.status(404).json({ error: 'Клиент не найден' });
      }

      const clientId = clientResult.rows[0].id;

      // Если businessId передан с фронта — сохраним его в настройках клиента на будущее
      if (businessId) {
        try {
          await client.query(
            `UPDATE clients 
             SET api_keys = jsonb_set(
               COALESCE(api_keys, '{}'::jsonb),
               '{yandex_market,business_id}',
               $1::jsonb,
               true
             )
             WHERE id = $2`,
            [JSON.stringify(Number(businessId) || businessId), clientId]
          );
        } catch (e) {
          // безопасно продолжаем, даже если не удалось сохранить
        }
      }

      // Загружаем товар на Яндекс Маркет
      const YandexMarketService = require('../services/yandexMarketService');
      const yandexService = new YandexMarketService();

      const result = await yandexService.uploadProductToMarket(clientId, productId, {
        marketCategoryId: marketCategoryId || null,
        parameterValues: Array.isArray(parameterValues) ? parameterValues : undefined
      });

      res.json({
        success: true,
        message: 'Товар успешно загружен на Яндекс Маркет',
        result: result
      });
    } catch (err) {
      console.error('Upload to Yandex Market error:', err);
      res.status(500).json({ 
        error: 'Ошибка загрузки товара на Яндекс Маркет',
        details: err.message 
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Upload to Yandex Market error:', err);
    res.status(500).json({ error: 'Ошибка загрузки товара' });
  }
});

// Яндекс.Маркет: дерево категорий
router.get('/yandex/categories', requireClient, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const r = await client.query('SELECT id FROM clients WHERE user_id = $1', [req.user.id]);
      if (r.rows.length === 0) return res.status(404).json({ error: 'Клиент не найден' });
      const clientId = r.rows[0].id;
      const YandexMarketService = require('../services/yandexMarketService');
      const ym = new YandexMarketService();
      const apiKey = await ym.getClientApiKey(clientId);
      if (!apiKey) return res.status(400).json({ error: 'API ключ Яндекс.Маркет не настроен' });
      const data = await ym.getCategoriesTree(apiKey, req.query.language || 'RU');
      const root = data?.categories || data?.result?.categories || data?.result || data;
      const flat = [];
      const walk = (nodes) => {
        if (!Array.isArray(nodes)) return;
        for (const n of nodes) {
          const id = n.id || n.categoryId;
          const name = n.name || n.title || String(id || '');
          const children = n.children || n.childs || n.items;
          if (Array.isArray(children) && children.length > 0) {
            walk(children);
          } else if (id) {
            flat.push({ id, name });
          }
        }
      };
      walk(root);
      res.json({ categories: flat });
    } finally {
      client.release();
    }
  } catch (e) {
    res.status(500).json({ error: 'Ошибка получения категорий Яндекс-Маркет' });
  }
});

// Яндекс.Маркет: параметры категории
router.post('/yandex/category/:categoryId/parameters', requireClient, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const r = await client.query('SELECT id FROM clients WHERE user_id = $1', [req.user.id]);
      if (r.rows.length === 0) return res.status(404).json({ error: 'Клиент не найден' });
      const clientId = r.rows[0].id;
      const YandexMarketService = require('../services/yandexMarketService');
      const ym = new YandexMarketService();
      const apiKey = await ym.getClientApiKey(clientId);
      if (!apiKey) return res.status(400).json({ error: 'API ключ Яндекс.Маркет не настроен' });
      const businessId = await ym.getBusinessId(clientId);
      if (!businessId) return res.status(400).json({ error: 'Business ID не настроен' });
      const data = await ym.getCategoryParameters(apiKey, req.params.categoryId, businessId, req.query.language || 'RU');
      res.json(data);
    } finally {
      client.release();
    }
  } catch (e) {
    res.status(500).json({ error: 'Ошибка получения параметров категории' });
  }
});

module.exports = router;


