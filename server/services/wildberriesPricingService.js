const axios = require('axios');
const { Pool } = require('pg');

class WildberriesPricingService {
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
    
    // Базовые URL для различных API Wildberries
    this.apiUrls = {
      statistics: 'https://statistics-api.wildberries.ru',
      marketplace: 'https://marketplace-api.wildberries.ru',
      common: 'https://common-api.wildberries.ru',
      analytics: 'https://analytics-api.wildberries.ru',
      content: 'https://content-api.wildberries.ru'
    };
  }

  /**
   * Получает информацию о товарах поставщика
   * @param {string} apiKey - API ключ Wildberries
   * @param {number} userId - ID пользователя
   * @returns {Array} Массив товаров с характеристиками
   */
  async fetchSupplierProducts(apiKey, userId) {
    try {
      console.log('Fetching Wildberries supplier products...');
      console.log('API Key (first 20 chars):', apiKey.substring(0, 20) + '...');
      
      // Получаем client_id из базы данных
      const client = await this.pool.connect();
      let clientId;
      try {
        const clientResult = await client.query('SELECT id FROM clients WHERE user_id = $1', [userId]);
        if (clientResult.rows.length === 0) {
          throw new Error('Client not found for user: ' + userId);
        }
        clientId = clientResult.rows[0].id;
        console.log('Found client_id:', clientId, 'for user:', userId);
      } finally {
        client.release();
      }
      
      // Метод 1: Content API - получить ВСЕ карточки товаров с пагинацией
      // Согласно документации: https://dev.wildberries.ru/openapi/work-with-products
      try {
        console.log('Trying Content API - cards/list with pagination...');
        
        let allProducts = [];
        let cursor = { limit: 100 };
        let totalFetched = 0;
        let hasMore = true;
        let logCalled = false; // Флаг для логирования структуры
        
        while (hasMore) {
          console.log(`Fetching cards... (fetched so far: ${totalFetched})`);
          
          const contentResponse = await axios.post(`${this.apiUrls.content}/content/v2/get/cards/list`, 
            {
              settings: {
                cursor: cursor,
                filter: {
                  withPhoto: -1  // Все карточки, включая без фото
                }
              }
            },
            {
          headers: {
                'Authorization': apiKey,
                'Content-Type': 'application/json'
              }
            }
          );
          
          console.log('Content API response received');
          
          if (contentResponse.data && contentResponse.data.cards && Array.isArray(contentResponse.data.cards)) {
            const cards = contentResponse.data.cards;
            console.log(`Found ${cards.length} cards in this batch`);
            
            // Преобразуем карточки в формат для кэширования
            const batchProducts = cards.map(card => {
              // Логируем первую карточку для диагностики
              if (!logCalled) {
                console.log('Sample card structure:', JSON.stringify(card, null, 2));
                logCalled = true;
              }
              
              // Пробуем разные варианты извлечения цены из карточки
              let current_price;
              
              // Вариант 1: Прямое поле price
              if (card.price) {
                current_price = card.price;
              }
              // Вариант 2: Из массива prices
              else if (card.prices && card.prices.length > 0) {
                const mainPrice = card.prices.find(p => p.id === '1') || card.prices.find(p => p.id === 'WBUOM+1') || card.prices[0];
                current_price = mainPrice?.price;
              }
              // Вариант 3: Из sizes
              else if (card.sizes && card.sizes.length > 0) {
                const sizeWithPrice = card.sizes.find(s => s.price);
                current_price = sizeWithPrice?.price;
              }
              
              // Извлекаем комиссию
              let commission_percent;
              if (card.commission) {
                commission_percent = card.commission;
              } else if (card.prices && card.prices.length > 0) {
                const mainPrice = card.prices.find(p => p.id === '1') || card.prices[0];
                commission_percent = mainPrice?.discount;
              }
              
              return {
                nmId: card.nmID || card.nm_id,
                article: card.vendorCode || card.supplierVendorCode || card.vendor_code,
                name: card.imt_name || card.title || card.imtName,
                brand: card.brand,
                category: card.objectName || card.object_name,
                length_cm: card.dimensions?.length || card.length,
                width_cm: card.dimensions?.width || card.width,
                height_cm: card.dimensions?.height || card.height,
                weight_kg: card.weightKg || card.weight_kg || card.weight,
                current_price: current_price,
                commission_percent: commission_percent
              };
            });
            
            // Сохраняем в БД
            await this.processAndCacheProducts(batchProducts, clientId);
            allProducts.push(...batchProducts);
            totalFetched += cards.length;
            
            // Проверяем, есть ли еще карточки для загрузки
            if (contentResponse.data.cursor && cards.length === cursor.limit) {
              // Берем cursor из ответа для следующего запроса
              cursor = {
                limit: 100,
                updatedAt: contentResponse.data.cursor.updatedAt,
                nmID: contentResponse.data.cursor.nmID
              };
              console.log('Loading next batch with cursor:', cursor);
            } else {
              hasMore = false;
              console.log('All cards loaded. Total:', totalFetched);
            }
          } else {
            hasMore = false;
          }
        }
        
        if (allProducts.length > 0) {
          console.log(`✅ Successfully loaded ${allProducts.length} cards from Content API`);
          
          // Получаем цены из заказов за последние 30 дней (статистика)
          console.log('Fetching prices from order statistics...');
          try {
            const statsResponse = await axios.get('https://statistics-api.wildberries.ru/api/v1/supplier/orders', {
              headers: {
                'Authorization': apiKey
              },
              params: {
                dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                dateTo: new Date().toISOString().split('T')[0]
              }
            });
            
            const orders = Array.isArray(statsResponse.data) ? statsResponse.data : [];
            console.log(`Found ${orders.length} orders for price calculation`);
            
            // Создаем мапу цен по nmId (берем последнюю цену для каждого товара)
            const priceMap = new Map();
            const commissionMap = new Map();
            
            orders.forEach(order => {
              const nmId = order.nmId || order.nmid;
              if (!nmId) return;
              
              const price = order.finishedPrice || order.priceWithDisc || order.price;
              if (price) {
                priceMap.set(nmId, price);
              }
              
              if (order.spp) {
                commissionMap.set(nmId, order.spp);
              }
            });
            
            console.log(`Found prices for ${priceMap.size} products from order history`);
            
            // Обновляем цены в товарах
            allProducts.forEach(product => {
              const price = priceMap.get(product.nmId);
              if (price) {
                product.current_price = price;
              }
              
              const commission = commissionMap.get(product.nmId);
              if (commission) {
                product.commission_percent = commission;
              }
            });
            
            console.log(`✅ Updated prices for ${priceMap.size} products from order history`);
            
            // Теперь нужно обновить цены в БД
            if (priceMap.size > 0) {
              console.log('Updating prices in database...');
              const client = await this.pool.connect();
              try {
                for (const [nmId, price] of priceMap.entries()) {
                  await client.query(
                    `UPDATE wb_products_cache 
                     SET current_price = $1, commission_percent = $2, last_updated = CURRENT_TIMESTAMP 
                     WHERE nm_id = $3 AND client_id = $4`,
                    [price, commissionMap.get(nmId) || null, nmId, clientId]
                  );
                }
                console.log(`✅ Updated database with ${priceMap.size} prices`);
              } finally {
                client.release();
              }
            }
          } catch (priceError) {
            console.log('⚠️ Could not fetch prices from orders:', priceError.response?.data || priceError.message);
            console.log('Products will be saved without prices');
          }
          
          return allProducts;
        }
      } catch (contentError) {
        console.log('❌ Content API failed:', contentError.response?.data || contentError.message);
      }

      // Метод 2: Content API - альтернативный формат запроса
      try {
        console.log('Trying Content API - alternative request format...');
        const altResponse = await axios.post(`${this.apiUrls.content}/content/v2/get/cards/list`, 
          {
            settings: {
              cursor: {
                limit: 100
              },
              filter: {
                withPhoto: -1
              }
            }
          },
          {
          headers: {
              'Authorization': apiKey,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (altResponse.data && altResponse.data.cards && Array.isArray(altResponse.data.cards)) {
          const cards = altResponse.data.cards;
          console.log(`Found ${cards.length} cards from alternative format`);
          
          const products = cards.map(card => ({
            nmId: card.nmID,
            article: card.vendorCode || card.supplierVendorCode,
            name: card.imt_name || card.title,
            brand: card.brand,
            category: card.objectName,
            current_price: card.price
          }));
          
          const processedProducts = await this.processAndCacheProducts(products, clientId);
          return processedProducts;
        }
      } catch (altError) {
        console.log('❌ Alternative format failed:', altError.response?.data || altError.message);
      }

      console.error('No products data received from any Wildberries API');
      console.error('Please ensure you have a valid Content API token from Wildberries.');
      console.error('Create token at: Profile → Integrations → API → Content');
      return [];
      
    } catch (error) {
      console.error('Error fetching Wildberries products:', error.response?.data || error.message);
      
      if (error.response?.status === 401) {
        console.error('API key is invalid or expired. Please get a new token from Wildberries seller panel.');
        return [];
      }
      
      throw error;
    }
  }

  /**
   * Получает актуальные цены товаров
   * @param {string} apiKey - API ключ Wildberries
   * @returns {Array} Массив цен товаров
   */
  async fetchProductPrices(apiKey) {
    try {
      console.log('Fetching Wildberries product prices...');
      
      const response = await axios.get(`${this.apiUrls.marketplace}/api/v1/public/cards/list`, {
        headers: {
          'Authorization': apiKey
        }
      });

      if (!response.data || !response.data.cards) {
        console.warn('No prices data received from Wildberries API');
        return [];
      }

      console.log(`Found ${response.data.cards.length} price records`);
      return response.data.cards;
    } catch (error) {
      console.error('Error fetching Wildberries prices:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Получает информацию о комиссиях маркетплейса
   * @param {string} apiKey - API ключ Wildberries
   * @returns {Object} Данные о комиссиях
   */
  async fetchCommissionRates(apiKey) {
    try {
      console.log('Fetching Wildberries commission rates...');
      
      // Используем API аналитики для получения данных о комиссиях
      const response = await axios.get(`${this.apiUrls.analytics}/api/v1/supplier/commission`, {
        headers: {
          'Authorization': apiKey
        }
      });

      if (!response.data) {
        console.warn('No commission data received from Wildberries API');
        return {};
      }

      console.log('Commission rates fetched successfully');
      return response.data;
    } catch (error) {
      console.error('Error fetching Wildberries commission rates:', error.response?.data || error.message);
      // Возвращаем дефолтные комиссии в случае ошибки
      return {
        default_commission: 5.0, // 5% по умолчанию
        categories: {}
      };
    }
  }

  /**
   * Обновляет цены товаров на маркетплейсе
   * @param {string} apiKey - API ключ Wildberries
   * @param {Array} priceUpdates - Массив обновлений цен
   * @returns {Object} Результат обновления
   */
  async updateProductPrices(apiKey, priceUpdates) {
    try {
      console.log(`Updating ${priceUpdates.length} product prices...`);
      
      const response = await axios.post(`${this.apiUrls.marketplace}/api/v1/cards/update`, {
        cards: priceUpdates
      }, {
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json'
        }
      });

      console.log('Prices updated successfully');
      return response.data;
    } catch (error) {
      console.error('Error updating Wildberries prices:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Получает информацию о текущих акциях
   * @param {string} apiKey - API ключ Wildberries
   * @returns {Array} Массив акций
   */
  async fetchCurrentPromotions(apiKey) {
    try {
      console.log('Fetching Wildberries promotions...');
      
      const response = await axios.get(`${this.apiUrls.marketplace}/api/v1/promotion/list`, {
        headers: {
          'Authorization': apiKey
        }
      });

      if (!response.data || !Array.isArray(response.data)) {
        console.warn('No promotions data received from Wildberries API');
        return [];
      }

      console.log(`Found ${response.data.length} active promotions`);
      return response.data;
    } catch (error) {
      console.error('Error fetching Wildberries promotions:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Выходит из акции для товара
   * @param {string} apiKey - API ключ Wildberries
   * @param {number} nmId - ID товара в Wildberries
   * @returns {Object} Результат выхода из акции
   */
  async exitPromotion(apiKey, nmId) {
    try {
      console.log(`Exiting promotion for product ${nmId}...`);
      
      const response = await axios.post(`${this.apiUrls.marketplace}/api/v1/promotion/exit`, {
        nmId: nmId
      }, {
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json'
        }
      });

      console.log(`Successfully exited promotion for product ${nmId}`);
      return response.data;
    } catch (error) {
      console.error(`Error exiting promotion for product ${nmId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Обрабатывает и кэширует данные о товарах
   * @param {Array} products - Массив товаров из API
   * @param {number} clientId - ID клиента
   * @returns {Array} Обработанные товары
   */
  async processAndCacheProducts(products, clientId) {
    const client = await this.pool.connect();
    try {
      const processedProducts = [];

      for (const product of products) {
        // Извлекаем данные о товаре
        console.log('Processing product:', product);
        const productData = {
          nm_id: product.nmId || product.nm_id,
          article: product.supplierArticle || product.article,
          name: product.subject || product.name,
          brand: product.brand,
          category: product.category,
          length_cm: product.length || product.length_cm,
          width_cm: product.width || product.width_cm,
          height_cm: product.height || product.height_cm,
          weight_kg: product.weight || product.weight_kg,
          current_price: product.price || product.current_price,
          commission_percent: product.commission || product.commission_percent,
          is_active: product.isActive !== false,
          in_promotion: product.inPromotion || false,
          promotion_discount_percent: product.promotionDiscount || 0
        };
        console.log('Product data:', productData);

        // Вычисляем стоимость логистики
        productData.logistics_cost = this.calculateLogisticsCost(productData);

        // Сохраняем или обновляем в кэше
        await this.upsertProductCache(client, productData, clientId);
        processedProducts.push(productData);
      }

      return processedProducts;
    } finally {
      client.release();
    }
  }

  /**
   * Рассчитывает стоимость логистики на основе габаритов товара
   * @param {Object} product - Данные о товаре
   * @returns {number} Стоимость логистики
   */
  calculateLogisticsCost(product) {
    if (!product.length_cm || !product.width_cm || !product.height_cm) {
      return 0;
    }

    // Рассчитываем объем в литрах
    const volumeLiters = (product.length_cm * product.width_cm * product.height_cm) / 1000;
    
    // Базовые тарифы логистики (можно настроить)
    const firstLiterRate = 50; // 50 рублей за первый литр
    const additionalLiterRate = 10; // 10 рублей за дополнительный литр
    
    if (volumeLiters <= 1) {
      return firstLiterRate;
    } else {
      return firstLiterRate + ((volumeLiters - 1) * additionalLiterRate);
    }
  }

  /**
   * Сохраняет или обновляет товар в кэше
   * @param {Object} client - Клиент базы данных
   * @param {Object} productData - Данные о товаре
   * @param {number} clientId - ID клиента
   */
  async upsertProductCache(client, productData, clientId) {
    const query = `
      INSERT INTO wb_products_cache (
        nm_id, article, name, brand, category, length_cm, width_cm, height_cm, 
        weight_kg, current_price, commission_percent, logistics_cost, 
        is_active, in_promotion, promotion_discount_percent, client_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (nm_id, client_id) 
      DO UPDATE SET
        article = EXCLUDED.article,
        name = EXCLUDED.name,
        brand = EXCLUDED.brand,
        category = EXCLUDED.category,
        length_cm = EXCLUDED.length_cm,
        width_cm = EXCLUDED.width_cm,
        height_cm = EXCLUDED.height_cm,
        weight_kg = EXCLUDED.weight_kg,
        current_price = EXCLUDED.current_price,
        commission_percent = EXCLUDED.commission_percent,
        logistics_cost = EXCLUDED.logistics_cost,
        is_active = EXCLUDED.is_active,
        in_promotion = EXCLUDED.in_promotion,
        promotion_discount_percent = EXCLUDED.promotion_discount_percent,
        last_updated = CURRENT_TIMESTAMP
    `;

    const values = [
      productData.nm_id,
      productData.article,
      productData.name,
      productData.brand,
      productData.category,
      productData.length_cm,
      productData.width_cm,
      productData.height_cm,
      productData.weight_kg,
      productData.current_price,
      productData.commission_percent,
      productData.logistics_cost,
      productData.is_active,
      productData.in_promotion,
      productData.promotion_discount_percent,
      clientId
    ];

    await client.query(query, values);
  }

  /**
   * Получает настройки ценообразования клиента
   * @param {number} clientId - ID клиента
   * @returns {Object} Настройки ценообразования
   */
  async getClientPricingSettings(clientId) {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM client_pricing_settings 
        WHERE client_id = $1 AND marketplace = 'wildberries'
      `;
      
      const result = await client.query(query, [clientId]);
      
      if (result.rows.length === 0) {
        // Создаем настройки по умолчанию
        return await this.createDefaultPricingSettings(clientId);
      }
      
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * Создает настройки ценообразования по умолчанию
   * @param {number} clientId - ID клиента
   * @returns {Object} Настройки по умолчанию
   */
  async createDefaultPricingSettings(clientId) {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO client_pricing_settings (client_id, marketplace)
        VALUES ($1, 'wildberries')
        RETURNING *
      `;
      
      const result = await client.query(query, [clientId]);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * Обновляет настройки ценообразования клиента
   * @param {number} clientId - ID клиента
   * @param {Object} settings - Новые настройки
   * @returns {Object} Обновленные настройки
   */
  async updateClientPricingSettings(clientId, settings) {
    const client = await this.pool.connect();
    try {
      const fields = Object.keys(settings).map((key, index) => `${key} = $${index + 2}`).join(', ');
      const values = [clientId, ...Object.values(settings)];
      
      const query = `
        UPDATE client_pricing_settings 
        SET ${fields}, updated_at = CURRENT_TIMESTAMP
        WHERE client_id = $1 AND marketplace = 'wildberries'
        RETURNING *
      `;
      
      const result = await client.query(query, values);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * Получает товары клиента из кэша
   * @param {number} clientId - ID клиента
   * @returns {Array} Массив товаров
   */
  async getClientProducts(clientId) {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM wb_products_cache 
        WHERE client_id = $1 AND is_active = true
        ORDER BY last_updated DESC
      `;
      
      const result = await client.query(query, [clientId]);
      return result.rows;
    } finally {
      client.release();
    }
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
   * Обновляет статус участия в акции
   * @param {number} nmId - ID товара в Wildberries
   * @param {boolean} inPromotion - Участвует ли в акции
   * @param {number} discountPercent - Процент скидки
   */
  async updateProductPromotionStatus(nmId, inPromotion, discountPercent = 0) {
    const client = await this.pool.connect();
    try {
      const query = `
        UPDATE wb_products_cache 
        SET in_promotion = $1, promotion_discount_percent = $2, last_updated = CURRENT_TIMESTAMP
        WHERE nm_id = $3
      `;
      
      await client.query(query, [inPromotion, discountPercent, nmId]);
    } finally {
      client.release();
    }
  }
}

module.exports = WildberriesPricingService;
