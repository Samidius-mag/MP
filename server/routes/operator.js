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

// ===== УПРАВЛЕНИЕ ПРАЙС-ЛИСТОМ =====

// Получение списка товаров в прайс-листе
router.get('/price-list', requireOperator, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('category').optional().trim(),
  query('brand').optional().trim(),
  query('search').optional().trim(),
  query('is_active').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { category, brand, search, is_active } = req.query;

    const client = await pool.connect();
    try {
      let whereClause = 'WHERE 1=1';
      let queryParams = [];
      let paramIndex = 1;

      if (category) {
        whereClause += ` AND category = $${paramIndex}`;
        queryParams.push(category);
        paramIndex++;
      }

      if (brand) {
        whereClause += ` AND brand = $${paramIndex}`;
        queryParams.push(brand);
        paramIndex++;
      }

      if (search) {
        whereClause += ` AND (article ILIKE $${paramIndex} OR name ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      if (is_active !== undefined) {
        whereClause += ` AND is_active = $${paramIndex}`;
        queryParams.push(is_active === 'true');
        paramIndex++;
      }

      // Получаем товары с остатками
      const productsResult = await client.query(
        `SELECT pl.*, i.quantity, i.reserved_quantity, i.available_quantity, i.warehouse_location
         FROM price_list pl
         LEFT JOIN inventory i ON pl.article = i.article
         ${whereClause}
         ORDER BY pl.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...queryParams, limit, offset]
      );

      // Получаем общее количество
      const countResult = await client.query(
        `SELECT COUNT(*) as total
         FROM price_list pl
         LEFT JOIN inventory i ON pl.article = i.article
         ${whereClause}`,
        queryParams
      );

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      res.json({
        products: productsResult.rows,
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
    console.error('Error fetching price list:', error);
    res.status(500).json({ error: 'Ошибка получения прайс-листа' });
  }
});

// Добавление товара в прайс-лист
router.post('/price-list', requireOperator, [
  body('article').notEmpty().trim(),
  body('name').notEmpty().trim(),
  body('purchase_price').isFloat({ min: 0 }),
  body('selling_price').isFloat({ min: 0 }),
  body('category').optional().trim(),
  body('brand').optional().trim(),
  body('description').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { article, name, purchase_price, selling_price, category, brand, description } = req.body;

    const client = await pool.connect();
    try {
      // Проверяем, не существует ли уже товар с таким артикулом
      const existingProduct = await client.query(
        'SELECT id FROM price_list WHERE article = $1',
        [article]
      );

      if (existingProduct.rows.length > 0) {
        return res.status(409).json({ error: 'Товар с таким артикулом уже существует' });
      }

      // Добавляем товар в прайс-лист
      const result = await client.query(
        `INSERT INTO price_list (article, name, purchase_price, selling_price, category, brand, description, markup_percent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          article,
          name,
          purchase_price,
          selling_price,
          category || null,
          brand || null,
          description || null,
          ((selling_price - purchase_price) / purchase_price * 100).toFixed(2)
        ]
      );

      const productId = result.rows[0].id;

      res.status(201).json({
        message: 'Товар добавлен в прайс-лист',
        productId,
        article
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error adding product to price list:', error);
    res.status(500).json({ error: 'Ошибка добавления товара' });
  }
});

// Обновление товара в прайс-листе
router.put('/price-list/:article', requireOperator, [
  body('name').optional().trim(),
  body('purchase_price').optional().isFloat({ min: 0 }),
  body('selling_price').optional().isFloat({ min: 0 }),
  body('category').optional().trim(),
  body('brand').optional().trim(),
  body('description').optional().trim(),
  body('is_active').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { article } = req.params;
    const updates = req.body;

    const client = await pool.connect();
    try {
      // Проверяем, существует ли товар
      const existingProduct = await client.query(
        'SELECT * FROM price_list WHERE article = $1',
        [article]
      );

      if (existingProduct.rows.length === 0) {
        return res.status(404).json({ error: 'Товар не найден' });
      }

      // Формируем запрос обновления
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
          updateFields.push(`${key} = $${paramIndex}`);
          updateValues.push(updates[key]);
          paramIndex++;
        }
      });

      // Пересчитываем наценку, если изменились цены
      if (updates.purchase_price || updates.selling_price) {
        const purchasePrice = updates.purchase_price || existingProduct.rows[0].purchase_price;
        const sellingPrice = updates.selling_price || existingProduct.rows[0].selling_price;
        const markupPercent = ((sellingPrice - purchasePrice) / purchasePrice * 100).toFixed(2);
        
        updateFields.push(`markup_percent = $${paramIndex}`);
        updateValues.push(markupPercent);
        paramIndex++;
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'Нет данных для обновления' });
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      updateValues.push(article);

      await client.query(
        `UPDATE price_list SET ${updateFields.join(', ')} WHERE article = $${paramIndex}`,
        updateValues
      );

      res.json({
        message: 'Товар обновлен',
        article
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Ошибка обновления товара' });
  }
});

// ===== УПРАВЛЕНИЕ ОСТАТКАМИ =====

// Обновление остатков товара
router.put('/inventory/:article', requireOperator, [
  body('quantity').isInt({ min: 0 }),
  body('warehouse_location').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { article } = req.params;
    const { quantity, warehouse_location } = req.body;

    const client = await pool.connect();
    try {
      // Проверяем, существует ли товар в прайс-листе
      const product = await client.query(
        'SELECT id FROM price_list WHERE article = $1',
        [article]
      );

      if (product.rows.length === 0) {
        return res.status(404).json({ error: 'Товар не найден в прайс-листе' });
      }

      // Получаем текущие остатки
      const currentInventory = await client.query(
        'SELECT quantity FROM inventory WHERE article = $1',
        [article]
      );

      const oldQuantity = currentInventory.rows.length > 0 ? currentInventory.rows[0].quantity : 0;

      // Обновляем или создаем запись об остатках
      await client.query(
        `INSERT INTO inventory (article, quantity, warehouse_location, last_updated_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (article) DO UPDATE SET
           quantity = EXCLUDED.quantity,
           warehouse_location = EXCLUDED.warehouse_location,
           last_updated_by = EXCLUDED.last_updated_by,
           updated_at = CURRENT_TIMESTAMP`,
        [article, quantity, warehouse_location || null, req.user.id]
      );

      res.json({
        message: 'Остатки обновлены',
        article,
        oldQuantity,
        newQuantity: quantity
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating inventory:', error);
    res.status(500).json({ error: 'Ошибка обновления остатков' });
  }
});

// Получение истории изменений остатков
router.get('/inventory/:article/history', requireOperator, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { article } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const client = await pool.connect();
    try {
      // Получаем историю изменений
      const historyResult = await client.query(
        `SELECT ih.*, u.first_name, u.last_name
         FROM inventory_history ih
         LEFT JOIN users u ON ih.changed_by = u.id
         WHERE ih.article = $1
         ORDER BY ih.created_at DESC
         LIMIT $2 OFFSET $3`,
        [article, limit, offset]
      );

      // Получаем общее количество записей
      const countResult = await client.query(
        'SELECT COUNT(*) as total FROM inventory_history WHERE article = $1',
        [article]
      );

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      res.json({
        history: historyResult.rows,
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
    console.error('Error fetching inventory history:', error);
    res.status(500).json({ error: 'Ошибка получения истории остатков' });
  }
});

// Массовое обновление остатков
router.post('/inventory/bulk-update', requireOperator, [
  body('updates').isArray({ min: 1 }),
  body('updates.*.article').notEmpty().trim(),
  body('updates.*.quantity').isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { updates } = req.body;

    const client = await pool.connect();
    try {
      const results = [];

      for (const update of updates) {
        const { article, quantity, warehouse_location } = update;

        // Проверяем, существует ли товар
        const product = await client.query(
          'SELECT id FROM price_list WHERE article = $1',
          [article]
        );

        if (product.rows.length === 0) {
          results.push({
            article,
            success: false,
            error: 'Товар не найден в прайс-листе'
          });
          continue;
        }

        // Получаем текущие остатки
        const currentInventory = await client.query(
          'SELECT quantity FROM inventory WHERE article = $1',
          [article]
        );

        const oldQuantity = currentInventory.rows.length > 0 ? currentInventory.rows[0].quantity : 0;

        // Обновляем остатки
        await client.query(
          `INSERT INTO inventory (article, quantity, warehouse_location, last_updated_by)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (article) DO UPDATE SET
             quantity = EXCLUDED.quantity,
             warehouse_location = EXCLUDED.warehouse_location,
             last_updated_by = EXCLUDED.last_updated_by,
             updated_at = CURRENT_TIMESTAMP`,
          [article, quantity, warehouse_location || null, req.user.id]
        );

        results.push({
          article,
          success: true,
          oldQuantity,
          newQuantity: quantity
        });
      }

      res.json({
        message: 'Массовое обновление завершено',
        results
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error bulk updating inventory:', error);
    res.status(500).json({ error: 'Ошибка массового обновления остатков' });
  }
});

module.exports = router;



