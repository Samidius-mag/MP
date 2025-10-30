const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticateToken, requireClient } = require('../middleware/auth');
const { pool } = require('../config/database');

// Ленивая инициализация сервисов
let wbPricingService, calculationService, automationService;

const getServices = () => {
  if (!wbPricingService) {
    const WildberriesPricingService = require('../services/wildberriesPricingService');
    const PricingCalculationService = require('../services/pricingCalculationService');
    const PricingAutomationService = require('../services/pricingAutomationService');
    
    wbPricingService = new WildberriesPricingService();
    calculationService = new PricingCalculationService();
    automationService = new PricingAutomationService();
  }
  return { wbPricingService, calculationService, automationService };
};

// Получение настроек ценообразования клиента
router.get('/settings', authenticateToken, async (req, res) => {
  try {
    const { wbPricingService } = getServices();
    const settings = await wbPricingService.getClientPricingSettings(req.user.id);
    res.json(settings);
  } catch (error) {
    console.error('Error fetching pricing settings:', error);
    res.status(500).json({ error: 'Failed to fetch pricing settings' });
  }
});

// Обновление настроек ценообразования
router.put('/settings', authenticateToken, async (req, res) => {
  try {
    const {
      markup_percent,
      acquiring_percent,
      max_discount_percent,
      first_liter_logistics_rub,
      additional_liter_logistics_rub,
      warehouse_coeff_percent,
      shipment_handling_rub,
      min_purchase_price_rub,
      max_purchase_price_rub,
      below_rrp,
      localization_index,
      maintain_margin_in_promotions,
      auto_exit_promotions
    } = req.body;

    const settings = {
      markup_percent,
      acquiring_percent,
      max_discount_percent,
      first_liter_logistics_rub,
      additional_liter_logistics_rub,
      warehouse_coeff_percent,
      shipment_handling_rub,
      min_purchase_price_rub,
      max_purchase_price_rub,
      below_rrp,
      localization_index,
      maintain_margin_in_promotions,
      auto_exit_promotions
    };

    const updatedSettings = await wbPricingService.updateClientPricingSettings(req.user.id, settings);
    res.json(updatedSettings);
  } catch (error) {
    console.error('Error updating pricing settings:', error);
    res.status(500).json({ error: 'Failed to update pricing settings' });
  }
});

// Получение товаров клиента
router.get('/products', authenticateToken, async (req, res) => {
  try {
    const products = await wbPricingService.getClientProducts(req.user.id);
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Синхронизация товаров с Wildberries
router.post('/sync-products', authenticateToken, async (req, res) => {
  try {
    console.log('Starting sync for user:', req.user.id);

    // Получаем API ключ из настроек пользователя (как в импорте заказов)
    const client = await pool.connect();
    let apiKey;
    
    try {
      const clientResult = await client.query(
        'SELECT api_keys FROM clients WHERE user_id = $1',
        [req.user.id]
      );

      if (clientResult.rows.length === 0) {
        return res.status(404).json({ error: 'Client not found' });
      }

      const apiKeys = clientResult.rows[0].api_keys || {};
      apiKey = apiKeys.wildberries?.api_key;
      
      if (!apiKey) {
        return res.status(400).json({ 
          error: 'Wildberries API key not configured',
          details: 'Please configure your Wildberries API key in Settings → API Keys'
        });
      }
      
      console.log('Using API key from user settings:', apiKey.substring(0, 10) + '...');
      
    } finally {
      client.release();
    }

    // Инициализируем сервисы
    const { wbPricingService } = getServices();
    
    if (!wbPricingService) {
      throw new Error('WildberriesPricingService not initialized');
    }

    const products = await wbPricingService.fetchSupplierProducts(apiKey, req.user.id);
    
    console.log('Sync completed. Products count:', products.length);
    
    res.json({ 
      message: 'Products synchronized successfully',
      count: products.length,
      products 
    });
  } catch (error) {
    console.error('Error syncing products:', error);
    console.error('Error stack:', error.stack);
    
    // Если ошибка авторизации, возвращаем специальное сообщение
    if (error.response?.status === 401) {
      return res.status(401).json({ 
        error: 'Invalid API key. Please check your Wildberries API token.',
        details: 'API access token not valid, most likely withdrawn. Please get a new token from your Wildberries seller panel.'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to sync products',
      details: error.message 
    });
  }
});

// Расчет цены для товара
router.post('/calculate-price', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.body;
    
    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    // Получаем данные о товаре
    const products = await wbPricingService.getClientProducts(req.user.id);
    console.log('Available products for user:', req.user.id, products.length);
    console.log('Looking for productId:', productId, 'type:', typeof productId);
    console.log('Product IDs in cache:', products.map(p => ({ nm_id: p.nm_id, type: typeof p.nm_id })));
    
    const product = products.find(p => {
      const pId = parseInt(p.nm_id);
      const searchId = parseInt(productId);
      const match = pId === searchId;
      console.log(`Comparing: ${pId} === ${searchId} = ${match}`);
      return match;
    });
    
    if (!product) {
      console.error('Product not found. Available products:', products.map(p => p.nm_id));
      return res.status(404).json({ error: 'Product not found' });
    }

    console.log('Found product:', product);
    
    // Получаем настройки ценообразования
    const settings = await wbPricingService.getClientPricingSettings(req.user.id);
    console.log('Settings:', settings);
    
    // Рассчитываем цену
    console.log('Calculating price...');
    const calculation = calculationService.calculateOptimalPrice(product, settings);
    console.log('Calculation result:', calculation);
    
    res.json(calculation);
  } catch (error) {
    console.error('Error calculating price:', error);
    res.status(500).json({ error: 'Failed to calculate price' });
  }
});

// Проверка необходимости обновления цен
router.get('/check-updates', authenticateToken, async (req, res) => {
  try {
    const productsToUpdate = await calculationService.getProductsNeedingPriceUpdate(req.user.id);
    
    res.json({
      count: productsToUpdate.length,
      products: productsToUpdate.map(({ product, checkResult }) => ({
        product: {
          nm_id: product.nm_id,
          article: product.article,
          name: product.name,
          current_price: product.current_price
        },
        checkResult: {
          needsUpdate: checkResult.needsUpdate,
          calculatedPrice: checkResult.calculatedPrice,
          priceDifference: checkResult.priceDifference,
          priceDifferencePercent: checkResult.priceDifferencePercent,
          recommendedAction: checkResult.recommendedAction,
          actualMargin: checkResult.actualMargin,
          targetMargin: checkResult.targetMargin
        }
      }))
    });
  } catch (error) {
    console.error('Error checking updates:', error);
    res.status(500).json({ error: 'Failed to check updates' });
  }
});

// Обновление цены товара
router.post('/update-price', authenticateToken, async (req, res) => {
  try {
    const { productId, newPrice, apiKey } = req.body;
    
    if (!productId || !newPrice || !apiKey) {
      return res.status(400).json({ error: 'Product ID, new price, and API key are required' });
    }

    // Получаем данные о товаре
    const products = await wbPricingService.getClientProducts(req.user.id);
    const product = products.find(p => p.nm_id === parseInt(productId));
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Обновляем цену на маркетплейсе
    await wbPricingService.updateProductPrices(apiKey, [{
      nmId: productId,
      price: parseFloat(newPrice)
    }]);

    // Обновляем цену в кэше
    await wbPricingService.updateProductCachePrice(productId, parseFloat(newPrice));

    // Логируем изменение
    const settings = await wbPricingService.getClientPricingSettings(req.user.id);
    const calculation = calculationService.calculateOptimalPrice(product, settings);
    calculation.finalPrice = parseFloat(newPrice);
    
    await calculationService.logPriceChange(
      req.user.id,
      product,
      calculation,
      'manual',
      'api'
    );

    res.json({ 
      message: 'Price updated successfully',
      productId,
      oldPrice: product.current_price,
      newPrice: parseFloat(newPrice)
    });
  } catch (error) {
    console.error('Error updating price:', error);
    res.status(500).json({ error: 'Failed to update price' });
  }
});

// Выход из акции
router.post('/exit-promotion', authenticateToken, async (req, res) => {
  try {
    const { productId, apiKey } = req.body;
    
    if (!productId || !apiKey) {
      return res.status(400).json({ error: 'Product ID and API key are required' });
    }

    // Выходим из акции
    await wbPricingService.exitPromotion(apiKey, parseInt(productId));

    // Обновляем статус в кэше
    await wbPricingService.updateProductPromotionStatus(productId, false, 0);

    res.json({ 
      message: 'Successfully exited promotion',
      productId
    });
  } catch (error) {
    console.error('Error exiting promotion:', error);
    res.status(500).json({ error: 'Failed to exit promotion' });
  }
});

// Управление автоматизацией
router.get('/automation/status', authenticateToken, async (req, res) => {
  try {
    const { Pool } = require('pg');
    const pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'dropshipping_db',
      user: 'dropshipping',
      password: 'KeyOfWorld2025',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    const client = await pool.connect();
    try {
      const query = `
        SELECT * FROM pricing_automation_settings 
        WHERE client_id = $1
      `;
      
      const result = await client.query(query, [req.user.id]);
      
      if (result.rows.length === 0) {
        res.json({ enabled: false });
      } else {
        res.json(result.rows[0]);
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching automation status:', error);
    res.status(500).json({ error: 'Failed to fetch automation status' });
  }
});

// Включение автоматизации
router.post('/automation/enable', authenticateToken, async (req, res) => {
  try {
    const {
      check_interval_hours = 1,
      notify_on_price_changes = true,
      notify_on_margin_violations = true,
      notify_email = null
    } = req.body;

    await automationService.enableAutomationForClient(req.user.id, {
      check_interval_hours,
      notify_on_price_changes,
      notify_on_margin_violations,
      notify_email
    });

    res.json({ message: 'Automation enabled successfully' });
  } catch (error) {
    console.error('Error enabling automation:', error);
    res.status(500).json({ error: 'Failed to enable automation' });
  }
});

// Отключение автоматизации
router.post('/automation/disable', authenticateToken, async (req, res) => {
  try {
    await automationService.disableAutomationForClient(req.user.id);
    res.json({ message: 'Automation disabled successfully' });
  } catch (error) {
    console.error('Error disabling automation:', error);
    res.status(500).json({ error: 'Failed to disable automation' });
  }
});

// Ручной запуск проверки цен
router.post('/automation/run-check', authenticateToken, async (req, res) => {
  try {
    const result = await automationService.runManualCheck(req.user.id);
    res.json({
      message: 'Manual check completed successfully',
      result
    });
  } catch (error) {
    console.error('Error running manual check:', error);
    res.status(500).json({ error: 'Failed to run manual check' });
  }
});

// Получение статистики ценообразования
router.get('/statistics', authenticateToken, async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    
    const pricingStats = await calculationService.getPricingStatistics(req.user.id, period);
    const automationStats = await automationService.getAutomationStatistics(req.user.id, period);
    
    res.json({
      period,
      pricing: pricingStats,
      automation: automationStats
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Получение истории изменений цен
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, period = 'week' } = req.query;
    const offset = (page - 1) * limit;
    
    const { Pool } = require('pg');
    const pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'dropshipping_db',
      user: 'dropshipping',
      password: 'KeyOfWorld2025',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    const client = await pool.connect();
    try {
      let dateFilter = '';
      const now = new Date();
      
      switch (period) {
        case 'day':
          const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          dateFilter = `AND changed_at >= '${dayAgo.toISOString()}'`;
          break;
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          dateFilter = `AND changed_at >= '${weekAgo.toISOString()}'`;
          break;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          dateFilter = `AND changed_at >= '${monthAgo.toISOString()}'`;
          break;
      }

      const query = `
        SELECT 
          ph.*,
          wpc.name as product_name,
          wpc.brand
        FROM pricing_history ph
        LEFT JOIN wb_products_cache wpc ON ph.nm_id = wpc.nm_id
        WHERE ph.client_id = $1 ${dateFilter}
        ORDER BY ph.changed_at DESC
        LIMIT $2 OFFSET $3
      `;
      
      const result = await client.query(query, [req.user.id, limit, offset]);
      
      // Получаем общее количество записей
      const countQuery = `
        SELECT COUNT(*) as total
        FROM pricing_history 
        WHERE client_id = $1 ${dateFilter}
      `;
      
      const countResult = await client.query(countQuery, [req.user.id]);
      const total = parseInt(countResult.rows[0].total);
      
      res.json({
        data: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching pricing history:', error);
    res.status(500).json({ error: 'Failed to fetch pricing history' });
  }
});

// Обновить цену товара
router.put('/update-price', requireClient, [
  body('productId').isNumeric().withMessage('Product ID is required'),
  body('newPrice').isNumeric().withMessage('New price is required')
], async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { productId, newPrice } = req.body;
    const userId = req.user.id;
    
    console.log(`Updating price for product ${productId} to ${newPrice} for user ${userId}`);
    
    // Обновляем цену в кэше товаров
    const updateQuery = `
      UPDATE wb_products_cache 
      SET current_price = $1, last_updated = NOW()
      WHERE nm_id = $2 AND client_id = $3
      RETURNING *
    `;
    
    const result = await client.query(updateQuery, [newPrice, productId, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Записываем в историю изменений
    const historyQuery = `
      INSERT INTO pricing_history (client_id, nm_id, article, old_price, new_price, change_reason, changed_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `;
    
    await client.query(historyQuery, [
      userId, 
      productId, 
      result.rows[0].article || 'N/A', // Используем артикул из товара или 'N/A'
      result.rows[0].current_price, 
      newPrice, 
      'manual_update'
    ]);
    
    console.log(`✅ Price updated successfully for product ${productId}`);
    
    res.json({ 
      success: true, 
      message: 'Price updated successfully',
      product: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error updating price:', error);
    res.status(500).json({ error: 'Failed to update price' });
  } finally {
    client.release();
  }
});

module.exports = router;
