const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { pool } = require('../config/database');
const { requireClient } = require('../middleware/auth');
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
    console.error('Orders error:', err);
    res.status(500).json({ error: 'Failed to get orders' });
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
          yandex_market: apiKeys.yandex_market || { api_key: '' }
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
  query('status').optional().isIn(['new', 'processing', 'shipped', 'delivered', 'cancelled'])
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
            `INSERT INTO orders (client_id, marketplace_order_id, marketplace, status, total_amount, customer_name, customer_phone, customer_email, delivery_address, items, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (client_id, marketplace_order_id, marketplace) DO UPDATE SET
             status = EXCLUDED.status,
             total_amount = EXCLUDED.total_amount,
             customer_name = EXCLUDED.customer_name,
             customer_phone = EXCLUDED.customer_phone,
             customer_email = EXCLUDED.customer_email,
             delivery_address = EXCLUDED.delivery_address,
             items = EXCLUDED.items,
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
              order.orderDate || new Date().toISOString()
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

    const { wildberries, ozon, yandex_market } = req.body;

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
        ...(yandex_market && { yandex_market })
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

      // Общая сумма заказов
      const totalAmountResult = await client.query(
        `SELECT COALESCE(SUM(total_amount), 0) as total
         FROM orders o
         JOIN clients c ON o.client_id = c.id
         WHERE c.user_id = $1`,
        [req.user.id]
      );

      // Заказы за последние 30 дней
      const recentOrdersResult = await client.query(
        `SELECT COUNT(*) as count
         FROM orders o
         JOIN clients c ON o.client_id = c.id
         WHERE c.user_id = $1 AND o.created_at >= NOW() - INTERVAL '30 days'`,
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
async function fetchWildberriesOrders(apiKey) {
  try {
    console.log('Fetching Wildberries orders...');
    
    const dateFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dateTo = new Date().toISOString().split('T')[0];
    
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

    return orders.map(order => {
      // Правильно обрабатываем дату из Wildberries API
      const orderDate = new Date(order.date);
      const formattedDate = orderDate.toISOString();
      
      return {
        orderId: order.gNumber || order.srid || order.nmId?.toString() || 'unknown',
        totalAmount: order.finishedPrice || order.priceWithDisc || order.totalPrice || 0,
        customerName: 'Клиент Wildberries',
        customerPhone: '',
        customerEmail: '',
        deliveryAddress: `${order.regionName}, ${order.oblastOkrugName}`,
        status: order.isCancel ? 'cancelled' : 'new',
        marketplace: 'wildberries',
        orderDate: formattedDate, // Добавляем дату заказа
        items: [{
          article: order.supplierArticle || order.nmId?.toString() || 'unknown',
          name: `${order.subject} ${order.brand ? `(${order.brand})` : ''}`.trim(),
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

module.exports = router;


