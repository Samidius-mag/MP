const cron = require('node-cron');
const WildberriesPricingService = require('./wildberriesPricingService');
const PricingCalculationService = require('./pricingCalculationService');
const { Pool } = require('pg');

class PricingAutomationService {
  constructor() {
    // Создаем отдельное подключение с правильными настройками
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'dropshipping_db',
      user: 'dropshipping', // Принудительно используем правильного пользователя
      password: 'KeyOfWorld2025', // Принудительно используем правильный пароль
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    this.wbPricingService = new WildberriesPricingService();
    this.calculationService = new PricingCalculationService();
    
    this.activeJobs = new Map();
    this.isRunning = false;
  }

  /**
   * Запускает автоматизацию ценообразования
   */
  async start() {
    if (this.isRunning) {
      console.log('Pricing automation is already running');
      return;
    }

    console.log('Starting pricing automation service...');
    this.isRunning = true;

    // Запускаем задачу каждый час
    const job = cron.schedule('0 * * * *', async () => {
      await this.runPricingCheck();
    }, {
      scheduled: false
    });

    this.activeJobs.set('hourly_check', job);
    job.start();

    console.log('Pricing automation service started');
  }

  /**
   * Останавливает автоматизацию ценообразования
   */
  async stop() {
    console.log('Stopping pricing automation service...');
    
    for (const [name, job] of this.activeJobs) {
      job.stop();
      console.log(`Stopped job: ${name}`);
    }
    
    this.activeJobs.clear();
    this.isRunning = false;
    
    console.log('Pricing automation service stopped');
  }

  /**
   * Выполняет проверку цен для всех клиентов
   */
  async runPricingCheck() {
    const startTime = new Date();
    console.log(`Starting pricing check at ${startTime.toISOString()}`);

    try {
      // Получаем всех клиентов с включенной автоматизацией
      const clients = await this.getClientsWithAutomation();
      
      let totalProductsChecked = 0;
      let totalPricesUpdated = 0;
      let totalPromotionsExited = 0;
      let totalErrors = 0;

      for (const client of clients) {
        try {
          const result = await this.processClientPricing(client);
          totalProductsChecked += result.productsChecked;
          totalPricesUpdated += result.pricesUpdated;
          totalPromotionsExited += result.promotionsExited;
          totalErrors += result.errors;
        } catch (error) {
          console.error(`Error processing client ${client.id}:`, error.message);
          totalErrors++;
        }
      }

      // Логируем результаты
      await this.logAutomationRun({
        started_at: startTime,
        finished_at: new Date(),
        status: 'completed',
        products_checked: totalProductsChecked,
        prices_updated: totalPricesUpdated,
        promotions_exited: totalPromotionsExited,
        errors_count: totalErrors
      });

      console.log(`Pricing check completed: ${totalProductsChecked} products checked, ${totalPricesUpdated} prices updated, ${totalPromotionsExited} promotions exited, ${totalErrors} errors`);

    } catch (error) {
      console.error('Error in pricing check:', error);
      
      await this.logAutomationRun({
        started_at: startTime,
        finished_at: new Date(),
        status: 'error',
        error_message: error.message,
        errors_count: 1
      });
    }
  }

  /**
   * Обрабатывает ценообразование для конкретного клиента
   * @param {Object} client - Данные клиента
   * @returns {Object} Результат обработки
   */
  async processClientPricing(client) {
    console.log(`Processing pricing for client ${client.id}`);
    
    let productsChecked = 0;
    let pricesUpdated = 0;
    let promotionsExited = 0;
    let errors = 0;

    try {
      // Получаем API ключ клиента
      const apiKey = await this.getClientApiKey(client.id);
      if (!apiKey) {
        console.warn(`No API key found for client ${client.id}`);
        return { productsChecked, pricesUpdated, promotionsExited, errors };
      }

      // Получаем настройки ценообразования
      const settings = await this.wbPricingService.getClientPricingSettings(client.id);
      
      // Получаем товары, требующие обновления цен
      const productsToUpdate = await this.calculationService.getProductsNeedingPriceUpdate(client.id);
      productsChecked = productsToUpdate.length;

      console.log(`Found ${productsChecked} products needing price updates for client ${client.id}`);

      for (const { product, checkResult, settings: clientSettings } of productsToUpdate) {
        try {
          if (checkResult.recommendedAction === 'exit_promotion') {
            // Выходим из акции
            await this.wbPricingService.exitPromotion(apiKey, product.nm_id);
            promotionsExited++;
            
            // Логируем изменение
            await this.calculationService.logPriceChange(
              client.id,
              product,
              checkResult.calculation,
              'promotion_exit',
              'automation'
            );
            
            console.log(`Exited promotion for product ${product.nm_id} (${product.article})`);
            
          } else if (checkResult.recommendedAction === 'adjust_price' || 
                     checkResult.recommendedAction === 'maintain_promotion') {
            // Обновляем цену
            await this.updateProductPrice(apiKey, product, checkResult.calculation);
            pricesUpdated++;
            
            // Логируем изменение
            await this.calculationService.logPriceChange(
              client.id,
              product,
              checkResult.calculation,
              'auto',
              'automation'
            );
            
            console.log(`Updated price for product ${product.nm_id} (${product.article}): ${product.current_price} -> ${checkResult.calculatedPrice}`);
          }
          
        } catch (error) {
          console.error(`Error processing product ${product.nm_id}:`, error.message);
          errors++;
        }
      }

    } catch (error) {
      console.error(`Error processing client ${client.id}:`, error.message);
      errors++;
    }

    return { productsChecked, pricesUpdated, promotionsExited, errors };
  }

  /**
   * Обновляет цену товара на маркетплейсе
   * @param {string} apiKey - API ключ
   * @param {Object} product - Данные о товаре
   * @param {Object} calculation - Результат расчета
   */
  async updateProductPrice(apiKey, product, calculation) {
    const priceUpdate = {
      nmId: product.nm_id,
      price: calculation.finalPrice
    };

    await this.wbPricingService.updateProductPrices(apiKey, [priceUpdate]);
    
    // Обновляем цену в кэше
    await this.updateProductCachePrice(product.nm_id, calculation.finalPrice);
  }

  /**
   * Обновляет цену товара в кэше
   * @param {number} nmId - ID товара в Wildberries
   * @param {number} newPrice - Новая цена
   */
  async updateProductCachePrice(nmId, newPrice) {
    const client = await this.pool.connect();
    try {
      const query = `
        UPDATE wb_products_cache 
        SET current_price = $1, last_updated = CURRENT_TIMESTAMP
        WHERE nm_id = $2
      `;
      
      await client.query(query, [newPrice, nmId]);
    } finally {
      client.release();
    }
  }

  /**
   * Получает клиентов с включенной автоматизацией
   * @returns {Array} Массив клиентов
   */
  async getClientsWithAutomation() {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT u.id, u.username, u.email, pas.enabled, pas.check_interval_hours
        FROM users u
        JOIN pricing_automation_settings pas ON u.id = pas.client_id
        WHERE u.role = 'client' AND pas.enabled = true
        ORDER BY u.id
      `;
      
      const result = await client.query(query);
      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Получает API ключ клиента
   * @param {number} clientId - ID клиента
   * @returns {string|null} API ключ или null
   */
  async getClientApiKey(clientId) {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT api_key FROM client_settings 
        WHERE client_id = $1 AND marketplace = 'wildberries'
      `;
      
      const result = await client.query(query, [clientId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0].api_key;
    } finally {
      client.release();
    }
  }

  /**
   * Логирует выполнение автоматизации
   * @param {Object} logData - Данные для логирования
   */
  async logAutomationRun(logData) {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO pricing_automation_logs (
          client_id, started_at, finished_at, status, products_checked,
          prices_updated, promotions_exited, errors_count, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;
      
      const values = [
        logData.client_id || null,
        logData.started_at,
        logData.finished_at,
        logData.status,
        logData.products_checked || 0,
        logData.prices_updated || 0,
        logData.promotions_exited || 0,
        logData.errors_count || 0,
        logData.error_message || null
      ];
      
      await client.query(query, values);
    } finally {
      client.release();
    }
  }

  /**
   * Включает автоматизацию для клиента
   * @param {number} clientId - ID клиента
   * @param {Object} settings - Настройки автоматизации
   */
  async enableAutomationForClient(clientId, settings = {}) {
    const client = await this.pool.connect();
    try {
      const {
        check_interval_hours = 1,
        notify_on_price_changes = true,
        notify_on_margin_violations = true,
        notify_email = null
      } = settings;

      const query = `
        INSERT INTO pricing_automation_settings (
          client_id, check_interval_hours, enabled, notify_on_price_changes,
          notify_on_margin_violations, notify_email
        ) VALUES ($1, $2, true, $3, $4, $5)
        ON CONFLICT (client_id) 
        DO UPDATE SET
          check_interval_hours = EXCLUDED.check_interval_hours,
          enabled = true,
          notify_on_price_changes = EXCLUDED.notify_on_price_changes,
          notify_on_margin_violations = EXCLUDED.notify_on_margin_violations,
          notify_email = EXCLUDED.notify_email,
          updated_at = CURRENT_TIMESTAMP
      `;
      
      await client.query(query, [
        clientId,
        check_interval_hours,
        notify_on_price_changes,
        notify_on_margin_violations,
        notify_email
      ]);
      
      console.log(`Enabled pricing automation for client ${clientId}`);
    } finally {
      client.release();
    }
  }

  /**
   * Отключает автоматизацию для клиента
   * @param {number} clientId - ID клиента
   */
  async disableAutomationForClient(clientId) {
    const client = await this.pool.connect();
    try {
      const query = `
        UPDATE pricing_automation_settings 
        SET enabled = false, updated_at = CURRENT_TIMESTAMP
        WHERE client_id = $1
      `;
      
      await client.query(query, [clientId]);
      
      console.log(`Disabled pricing automation for client ${clientId}`);
    } finally {
      client.release();
    }
  }

  /**
   * Получает статистику автоматизации
   * @param {number} clientId - ID клиента
   * @param {string} period - Период (day/week/month)
   * @returns {Object} Статистика
   */
  async getAutomationStatistics(clientId, period = 'week') {
    const client = await this.pool.connect();
    try {
      let dateFilter = '';
      const now = new Date();
      
      switch (period) {
        case 'day':
          const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          dateFilter = `AND started_at >= '${dayAgo.toISOString()}'`;
          break;
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          dateFilter = `AND started_at >= '${weekAgo.toISOString()}'`;
          break;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          dateFilter = `AND started_at >= '${monthAgo.toISOString()}'`;
          break;
      }

      const query = `
        SELECT 
          COUNT(*) as total_runs,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_runs,
          COUNT(CASE WHEN status = 'error' THEN 1 END) as failed_runs,
          SUM(products_checked) as total_products_checked,
          SUM(prices_updated) as total_prices_updated,
          SUM(promotions_exited) as total_promotions_exited,
          SUM(errors_count) as total_errors,
          AVG(EXTRACT(EPOCH FROM (finished_at - started_at))) as avg_duration_seconds
        FROM pricing_automation_logs 
        WHERE client_id = $1 ${dateFilter}
      `;
      
      const result = await client.query(query, [clientId]);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * Запускает ручную проверку цен для клиента
   * @param {number} clientId - ID клиента
   * @returns {Object} Результат проверки
   */
  async runManualCheck(clientId) {
    console.log(`Running manual pricing check for client ${clientId}`);
    
    const startTime = new Date();
    
    try {
      const client = await this.getClientsWithAutomation().then(clients => 
        clients.find(c => c.id === clientId)
      );
      
      if (!client) {
        throw new Error('Client not found or automation not enabled');
      }
      
      const result = await this.processClientPricing(client);
      
      await this.logAutomationRun({
        client_id: clientId,
        started_at: startTime,
        finished_at: new Date(),
        status: 'completed',
        products_checked: result.productsChecked,
        prices_updated: result.pricesUpdated,
        promotions_exited: result.promotionsExited,
        errors_count: result.errors
      });
      
      return result;
    } catch (error) {
      console.error(`Error in manual check for client ${clientId}:`, error);
      
      await this.logAutomationRun({
        client_id: clientId,
        started_at: startTime,
        finished_at: new Date(),
        status: 'error',
        error_message: error.message,
        errors_count: 1
      });
      
      throw error;
    }
  }
}

module.exports = PricingAutomationService;
