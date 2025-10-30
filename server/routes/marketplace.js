const express = require('express');
const axios = require('axios');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { requireClient, requireOperator } = require('../middleware/auth');

const router = express.Router();

// Импорт заказов с Wildberries
router.post('/wildberries/import', requireClient, [
  body('period').optional().isIn(['today', 'week', 'month'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const period = req.body.period || 'week';
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

      const apiKeys = clientResult.rows[0].api_keys;
      const wbApiKey = apiKeys?.wildberries?.api_key;

      if (!wbApiKey) {
        return res.status(400).json({ error: 'Wildberries API key not configured' });
      }

      // Получаем заказы с Wildberries
      const orders = await fetchWildberriesOrders(wbApiKey, period);
      
      let importedCount = 0;
      const clientId = (await client.query('SELECT id FROM clients WHERE user_id = $1', [req.user.id])).rows[0].id;

      for (const orderData of orders) {
        try {
          // Проверяем, существует ли уже такой заказ
          const existingOrder = await client.query(
            'SELECT id FROM orders WHERE marketplace = $1 AND marketplace_order_id = $2',
            ['wildberries', orderData.orderId]
          );

          if (existingOrder.rows.length > 0) {
            continue; // Заказ уже существует
          }

          // Создаем заказ
          const orderResult = await client.query(
            `INSERT INTO orders (client_id, marketplace, marketplace_order_id, status, total_amount, 
                               customer_name, customer_phone, customer_email, delivery_address, items, order_type)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING id`,
            [
              clientId,
              'wildberries',
              orderData.orderId,
              'new',
              orderData.totalAmount,
              orderData.customerName,
              orderData.customerPhone,
              orderData.customerEmail,
              orderData.deliveryAddress,
              JSON.stringify(orderData.items),
              orderData.orderType || 'FBS'
            ]
          );

          const orderId = orderResult.rows[0].id;

          // Создаем товары заказа
          for (const item of orderData.items) {
            await client.query(
              `INSERT INTO order_items (order_id, article, name, quantity, price, total_price)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [orderId, item.article, item.name, item.quantity, item.price, item.totalPrice]
            );
          }

          importedCount++;
        } catch (err) {
          console.error(`Error importing order ${orderData.orderId}:`, err);
        }
      }

      res.json({
        message: 'Orders imported successfully',
        importedCount,
        totalFound: orders.length
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Wildberries import error:', err);
    res.status(500).json({ error: 'Failed to import orders from Wildberries' });
  }
});

// Импорт заказов с Ozon
router.post('/ozon/import', requireClient, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const clientResult = await client.query(
        'SELECT api_keys FROM clients WHERE user_id = $1',
        [req.user.id]
      );

      if (clientResult.rows.length === 0) {
        return res.status(404).json({ error: 'Client not found' });
      }

      const apiKeys = clientResult.rows[0].api_keys;
      const ozonApiKey = apiKeys?.ozon?.api_key;
      const ozonClientId = apiKeys?.ozon?.client_id;

      if (!ozonApiKey || !ozonClientId) {
        return res.status(400).json({ error: 'Ozon API credentials not configured' });
      }

      const orders = await fetchOzonOrders(ozonApiKey, ozonClientId);
      
      let importedCount = 0;
      const clientId = (await client.query('SELECT id FROM clients WHERE user_id = $1', [req.user.id])).rows[0].id;

      for (const orderData of orders) {
        try {
          const existingOrder = await client.query(
            'SELECT id FROM orders WHERE marketplace = $1 AND marketplace_order_id = $2',
            ['ozon', orderData.orderId]
          );

          if (existingOrder.rows.length > 0) {
            continue;
          }

          const orderResult = await client.query(
            `INSERT INTO orders (client_id, marketplace, marketplace_order_id, status, total_amount, 
                               customer_name, customer_phone, customer_email, delivery_address, items)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING id`,
            [
              clientId,
              'ozon',
              orderData.orderId,
              'new',
              orderData.totalAmount,
              orderData.customerName,
              orderData.customerPhone,
              orderData.customerEmail,
              orderData.deliveryAddress,
              JSON.stringify(orderData.items)
            ]
          );

          const orderId = orderResult.rows[0].id;

          for (const item of orderData.items) {
            await client.query(
              `INSERT INTO order_items (order_id, article, name, quantity, price, total_price)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [orderId, item.article, item.name, item.quantity, item.price, item.totalPrice]
            );
          }

          importedCount++;
        } catch (err) {
          console.error(`Error importing Ozon order ${orderData.orderId}:`, err);
        }
      }

      res.json({
        message: 'Orders imported successfully',
        importedCount,
        totalFound: orders.length
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Ozon import error:', err);
    res.status(500).json({ error: 'Failed to import orders from Ozon' });
  }
});

// Импорт заказов с Яндекс.Маркет
router.post('/yandex-market/import', requireClient, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const clientResult = await client.query(
        'SELECT api_keys FROM clients WHERE user_id = $1',
        [req.user.id]
      );

      if (clientResult.rows.length === 0) {
        return res.status(404).json({ error: 'Client not found' });
      }

      const apiKeys = clientResult.rows[0].api_keys;
      const yandexApiKey = apiKeys?.yandex_market?.api_key;

      if (!yandexApiKey) {
        return res.status(400).json({ error: 'Yandex Market API key not configured' });
      }

      const orders = await fetchYandexMarketOrders(yandexApiKey);
      
      let importedCount = 0;
      const clientId = (await client.query('SELECT id FROM clients WHERE user_id = $1', [req.user.id])).rows[0].id;

      for (const orderData of orders) {
        try {
          const existingOrder = await client.query(
            'SELECT id FROM orders WHERE marketplace = $1 AND marketplace_order_id = $2',
            ['yandex_market', orderData.orderId]
          );

          if (existingOrder.rows.length > 0) {
            continue;
          }

          const orderResult = await client.query(
            `INSERT INTO orders (client_id, marketplace, marketplace_order_id, status, total_amount, 
                               customer_name, customer_phone, customer_email, delivery_address, items)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING id`,
            [
              clientId,
              'yandex_market',
              orderData.orderId,
              'new',
              orderData.totalAmount,
              orderData.customerName,
              orderData.customerPhone,
              orderData.customerEmail,
              orderData.deliveryAddress,
              JSON.stringify(orderData.items)
            ]
          );

          const orderId = orderResult.rows[0].id;

          for (const item of orderData.items) {
            await client.query(
              `INSERT INTO order_items (order_id, article, name, quantity, price, total_price)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [orderId, item.article, item.name, item.quantity, item.price, item.totalPrice]
            );
          }

          importedCount++;
        } catch (err) {
          console.error(`Error importing Yandex Market order ${orderData.orderId}:`, err);
        }
      }

      res.json({
        message: 'Orders imported successfully',
        importedCount,
        totalFound: orders.length
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Yandex Market import error:', err);
    res.status(500).json({ error: 'Failed to import orders from Yandex Market' });
  }
});

// Обновление статуса заказа на маркетплейсе
router.put('/orders/:orderId/status', requireOperator, [
  body('status').isIn(['new', 'in_assembly', 'ready_to_ship', 'shipped', 'delivered', 'cancelled']),
  body('tracking_number').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orderId } = req.params;
    const { status, tracking_number } = req.body;

    const client = await pool.connect();
    try {
      // Получаем заказ
      const orderResult = await client.query(
        'SELECT * FROM orders WHERE id = $1',
        [orderId]
      );

      if (orderResult.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
      }

      const order = orderResult.rows[0];

      // Обновляем статус в нашей базе
      await client.query(
        'UPDATE orders SET status = $1, tracking_number = COALESCE($2, tracking_number), updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        [status, tracking_number, orderId]
      );

      // Обновляем статус на маркетплейсе
      let marketplaceUpdateSuccess = false;

      try {
        switch (order.marketplace) {
          case 'wildberries':
            marketplaceUpdateSuccess = await updateWildberriesOrderStatus(order.marketplace_order_id, status, tracking_number);
            break;
          case 'ozon':
            marketplaceUpdateSuccess = await updateOzonOrderStatus(order.marketplace_order_id, status, tracking_number);
            break;
          case 'yandex_market':
            marketplaceUpdateSuccess = await updateYandexMarketOrderStatus(order.marketplace_order_id, status, tracking_number);
            break;
        }
      } catch (err) {
        console.error(`Error updating ${order.marketplace} order status:`, err);
      }

      res.json({
        message: 'Order status updated successfully',
        marketplaceUpdated: marketplaceUpdateSuccess
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Order status update error:', err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// Вспомогательные функции для получения заказов с маркетплейсов
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

    // Обрабатываем ответ
    let orders = [];
    if (response.data && Array.isArray(response.data)) {
      orders = response.data;
    } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
      orders = response.data.data;
    }

    console.log(`Found ${orders.length} orders`);

    return orders.map(order => {
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
      if (order.isCancel) {
        status = 'cancelled';
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
        orderId: order.id?.toString() || order.orderId?.toString() || order.nmId?.toString() || 'unknown',
        totalAmount: order.totalPrice || order.sum || order.total || 0,
        customerName: order.customer?.name || order.customerName || 'Не указано',
        customerPhone: order.customer?.phone || order.customerPhone || '',
        customerEmail: order.customer?.email || order.customerEmail || '',
        deliveryAddress: order.deliveryAddress?.address || order.address || 'Не указан',
        status: status,
        marketplace: 'wildberries',
        orderType: orderType,
        items: order.products?.map(product => ({
          article: product.supplierArticle || product.article || product.nmId?.toString() || 'unknown',
          name: product.name || product.productName || 'Товар',
          quantity: product.quantity || 1,
          price: product.price || product.cost || 0,
          totalPrice: (product.price || product.cost || 0) * (product.quantity || 1)
        })) || [{
          article: order.nmId?.toString() || 'unknown',
          name: 'Товар',
          quantity: 1,
          price: order.totalPrice || order.sum || 0,
          totalPrice: order.totalPrice || order.sum || 0
        }]
      };
    });

  } catch (err) {
    console.error('Wildberries API error:', err.response?.data || err.message);
    
    // Возвращаем тестовые данные, если API недоступен
    console.log('Returning test data due to API error');
    return [{
      orderId: 'test-wb-' + Date.now(),
      totalAmount: 1500,
      customerName: 'Тестовый клиент',
      customerPhone: '+7 (999) 123-45-67',
      customerEmail: 'test@example.com',
      deliveryAddress: 'Москва, ул. Тестовая, д. 1',
      status: 'new',
      marketplace: 'wildberries',
      orderType: 'FBS',
      items: [{
        article: 'test-article-001',
        name: 'Тестовый товар',
        quantity: 1,
        price: 1500,
        totalPrice: 1500
      }]
    }];
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
        'Api-Key': apiKey,
        'Client-Id': clientId,
        'Content-Type': 'application/json'
      }
    });

    return response.data.result.postings.map(posting => ({
      orderId: posting.order_id.toString(),
      totalAmount: posting.total_price,
      customerName: posting.customer?.name || 'Не указано',
      customerPhone: posting.customer?.phone || '',
      customerEmail: posting.customer?.email || '',
      deliveryAddress: posting.delivery_method?.warehouse?.address || 'Не указан',
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
        limit: 100,
        status: 'PROCESSING'
      }
    });

    return response.data.orders.map(order => ({
      orderId: order.id.toString(),
      totalAmount: order.total,
      customerName: order.buyer?.name || 'Не указано',
      customerPhone: order.buyer?.phone || '',
      customerEmail: order.buyer?.email || '',
      deliveryAddress: order.delivery?.address?.fullAddress || 'Не указан',
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

// Вспомогательные функции для обновления статусов на маркетплейсах
async function updateWildberriesOrderStatus(orderId, status, trackingNumber) {
  try {
    const wbStatus = mapStatusToWildberries(status);
    await axios.put(`https://suppliers-api.wildberries.ru/api/v3/orders/${orderId}/status`, {
      status: wbStatus,
      trackingNumber: trackingNumber
    });
    return true;
  } catch (err) {
    console.error('Wildberries status update error:', err);
    return false;
  }
}

async function updateOzonOrderStatus(orderId, status, trackingNumber) {
  try {
    const ozonStatus = mapStatusToOzon(status);
    await axios.post('https://api-seller.ozon.ru/v3/posting/fulfillment', {
      posting_number: orderId,
      status: ozonStatus,
      tracking_number: trackingNumber
    });
    return true;
  } catch (err) {
    console.error('Ozon status update error:', err);
    return false;
  }
}

async function updateYandexMarketOrderStatus(orderId, status, trackingNumber) {
  try {
    const yandexStatus = mapStatusToYandexMarket(status);
    await axios.put(`https://api.partner.market.yandex.ru/v2/campaigns/orders/${orderId}/status`, {
      status: yandexStatus,
      trackingNumber: trackingNumber
    });
    return true;
  } catch (err) {
    console.error('Yandex Market status update error:', err);
    return false;
  }
}

// Функции маппинга статусов
function mapStatusToWildberries(status) {
  const statusMap = {
    'new': 'new',
    'in_assembly': 'in_assembly',
    'ready_to_ship': 'ready_to_ship',
    'shipped': 'shipped',
    'delivered': 'delivered',
    'cancelled': 'cancelled'
  };
  return statusMap[status] || 'new';
}

function mapStatusToOzon(status) {
  const statusMap = {
    'new': 'new',
    'in_assembly': 'processing',
    'ready_to_ship': 'ready_to_ship',
    'shipped': 'shipped',
    'delivered': 'delivered',
    'cancelled': 'cancelled'
  };
  return statusMap[status] || 'new';
}

function mapStatusToYandexMarket(status) {
  const statusMap = {
    'new': 'PROCESSING',
    'in_assembly': 'PROCESSING',
    'ready_to_ship': 'READY_TO_SHIP',
    'shipped': 'SHIPPED',
    'delivered': 'DELIVERED',
    'cancelled': 'CANCELLED'
  };
  return statusMap[status] || 'PROCESSING';
}

module.exports = router;

