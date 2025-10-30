const { pool } = require('../config/database');

class OrderPaymentService {
  /**
   * Обрабатывает списание с депозита при поступлении заказа
   * @param {number} clientId - ID клиента
   * @param {Object} order - Данные заказа
   * @param {string} order.marketplace_order_id - ID заказа на маркетплейсе
   * @param {string} order.marketplace - Маркетплейс (wildberries, ozon, etc.)
   * @param {number} order.total_amount - Общая сумма заказа
   * @param {Array} order.items - Товары в заказе
   * @returns {Object} Результат обработки платежа
   */
  async processOrderPayment(clientId, order) {
    const client = await pool.connect();
    try {
      // Получаем текущий баланс клиента
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

      // Рассчитываем сумму к списанию (закупочная стоимость товаров)
      const purchaseAmount = await this.calculatePurchaseAmount(order.items, clientId);

      // Проверяем достаточность средств
      if (currentBalance < purchaseAmount) {
        return {
          success: false,
          error: 'Недостаточно средств на депозите',
          currentBalance,
          requiredAmount: purchaseAmount,
          shortfall: purchaseAmount - currentBalance
        };
      }

      // Создаем запись о списании
      const newBalance = currentBalance - purchaseAmount;
      const depositResult = await client.query(
        `INSERT INTO deposits (client_id, amount, balance_before, balance_after, transaction_type, description, payment_method, payment_id, status)
         VALUES ($1, $2, $3, $4, 'order_payment', $5, 'internal', $6, 'completed')
         RETURNING id`,
        [
          clientId,
          -purchaseAmount, // Отрицательная сумма для списания
          currentBalance,
          newBalance,
          `Оплата заказа ${order.marketplace_order_id} с ${order.marketplace}`,
          `order_${order.marketplace_order_id}_${Date.now()}`
        ]
      );

      const depositId = depositResult.rows[0].id;

      // Обновляем статус заказа
      await client.query(
        'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE client_id = $2 AND marketplace_order_id = $3 AND marketplace = $4',
        ['in_assembly', clientId, order.marketplace_order_id, order.marketplace]
      );

      // Отправляем уведомление клиенту
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message)
         SELECT c.user_id, 'internal', 'Заказ оплачен', 
                'С вашего депозита списано ${purchaseAmount} ₽ за заказ ${order.marketplace_order_id}. Новый баланс: ${newBalance} ₽'
         FROM clients c WHERE c.id = $1`,
        [clientId]
      );

      return {
        success: true,
        depositId,
        amount: purchaseAmount,
        newBalance,
        orderId: order.marketplace_order_id
      };

    } catch (error) {
      console.error('Order payment processing error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Рассчитывает закупочную стоимость товаров в заказе
   * @param {Array} items - Товары в заказе
   * @param {number} clientId - ID клиента
   * @returns {number} Закупочная стоимость
   */
  async calculatePurchaseAmount(items, clientId) {
    const client = await pool.connect();
    try {
      let totalPurchaseAmount = 0;

      for (const item of items) {
        // Пытаемся найти закупочную по ШК в складе
        let purchasePrice = null;

        if (item.skus && Array.isArray(item.skus) && item.skus.length > 0) {
          const skuBarcode = String(item.skus[0]);
          const whRes = await client.query(
            'SELECT purchase_price FROM warehouse_items WHERE client_id = $1 AND barcode = $2 LIMIT 1',
            [clientId, skuBarcode]
          );
          if (whRes.rows.length > 0) {
            purchasePrice = parseFloat(whRes.rows[0].purchase_price);
          }
        }

        if (purchasePrice === null) {
          // Fallback: прайс-лист по артикулу
          const priceResult = await client.query(
            'SELECT purchase_price FROM price_list WHERE article = $1 AND is_active = true',
            [item.article]
          );
          if (priceResult.rows.length > 0) {
            purchasePrice = parseFloat(priceResult.rows[0].purchase_price);
          }
        }

        if (purchasePrice === null) {
          // Последний резервный вариант: 70% от цены продажи
          purchasePrice = parseFloat(item.price) * 0.7;
          console.warn(`Товар ${item.article} не найден (ШК/прайс), используется расчетная цена: ${purchasePrice}`);
        }

        totalPurchaseAmount += purchasePrice * (item.quantity || 1);
      }

      return totalPurchaseAmount;
    } finally {
      client.release();
    }
  }

  /**
   * Обрабатывает возврат средств при возврате товара
   * @param {number} orderId - ID заказа
   * @param {string} article - Артикул товара
   * @param {number} quantity - Количество возвращаемого товара
   * @param {string} reason - Причина возврата
   * @returns {Object} Результат обработки возврата
   */
  async processProductReturn(orderId, article, quantity, reason) {
    const client = await pool.connect();
    try {
      // Получаем информацию о заказе
      const orderResult = await client.query(
        'SELECT client_id, marketplace_order_id, marketplace, items FROM orders WHERE id = $1',
        [orderId]
      );

      if (orderResult.rows.length === 0) {
        return {
          success: false,
          error: 'Заказ не найден'
        };
      }

      const order = orderResult.rows[0];
      const items = JSON.parse(order.items);

      // Находим товар в заказе
      const orderItem = items.find(item => item.article === article);
      if (!orderItem) {
        return {
          success: false,
          error: 'Товар не найден в заказе'
        };
      }

      // Рассчитываем сумму к возврату
      const refundAmount = await this.calculatePurchaseAmount([orderItem], order.client_id);
      const actualRefundAmount = (refundAmount / orderItem.quantity) * quantity;

      // Получаем текущий баланс
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

      // Создаем запись о возврате
      const newBalance = currentBalance + actualRefundAmount;
      const depositResult = await client.query(
        `INSERT INTO deposits (client_id, amount, balance_before, balance_after, transaction_type, description, payment_method, payment_id, status)
         VALUES ($1, $2, $3, $4, 'return', $5, 'internal', $6, 'completed')
         RETURNING id`,
        [
          order.client_id,
          actualRefundAmount,
          currentBalance,
          newBalance,
          `Возврат за товар ${article} по заказу ${order.marketplace_order_id}. Причина: ${reason}`,
          `return_${orderId}_${Date.now()}`
        ]
      );

      const depositId = depositResult.rows[0].id;

      // Создаем запись о возврате товара
      await client.query(
        `INSERT INTO product_returns (order_id, article, quantity, return_reason, refund_amount, return_status)
         VALUES ($1, $2, $3, $4, $5, 'processed')`,
        [orderId, article, quantity, reason, actualRefundAmount]
      );

      // Отправляем уведомление клиенту
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message)
         SELECT c.user_id, 'internal', 'Возврат обработан', 
                'На ваш депозит возвращено ${actualRefundAmount} ₽ за возврат товара ${article}. Новый баланс: ${newBalance} ₽'
         FROM clients c WHERE c.id = $1`,
        [order.client_id]
      );

      return {
        success: true,
        depositId,
        refundAmount: actualRefundAmount,
        newBalance,
        orderId: order.marketplace_order_id
      };

    } catch (error) {
      console.error('Product return processing error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Получает историю платежей по заказам
   * @param {number} clientId - ID клиента
   * @param {Object} filters - Фильтры
   * @returns {Array} История платежей
   */
  async getOrderPaymentHistory(clientId, filters = {}) {
    const client = await pool.connect();
    try {
      let whereClause = 'WHERE client_id = $1 AND transaction_type = $2';
      let queryParams = [clientId, 'order_payment'];
      let paramIndex = 3;

      if (filters.dateFrom) {
        whereClause += ` AND created_at >= $${paramIndex}`;
        queryParams.push(filters.dateFrom);
        paramIndex++;
      }

      if (filters.dateTo) {
        whereClause += ` AND created_at <= $${paramIndex}`;
        queryParams.push(filters.dateTo);
        paramIndex++;
      }

      const result = await client.query(
        `SELECT id, amount, balance_before, balance_after, description, created_at
         FROM deposits 
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT 100`,
        queryParams
      );

      return result.rows;
    } finally {
      client.release();
    }
  }
}

module.exports = new OrderPaymentService();


