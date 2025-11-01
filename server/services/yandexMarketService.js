const axios = require('axios');
const { pool } = require('../config/database');

class YandexMarketService {
  constructor() {
    this.baseUrl = 'https://api.partner.market.yandex.ru';
  }

  /**
   * Получить API ключ клиента для Яндекс Маркета
   */
  async getClientApiKey(clientId) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT api_keys FROM clients WHERE id = $1',
        [clientId]
      );

      if (result.rows.length === 0) {
        throw new Error('Client not found');
      }

      const apiKeys = result.rows[0].api_keys || {};
      return apiKeys.yandex_market?.api_key;
    } finally {
      client.release();
    }
  }

  /**
   * Получить Warehouse ID из настроек клиента (yandex_market.warehouse_id)
   */
  async getClientWarehouseId(clientId) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT api_keys FROM clients WHERE id = $1',
        [clientId]
      );
      if (result.rows.length === 0) return null;
      const apiKeys = result.rows[0].api_keys || {};
      return apiKeys.yandex_market?.warehouse_id || null;
    } finally {
      client.release();
    }
  }

  /**
   * Получить первый доступный campaignId для клиента
   */
  async getCampaignId(clientId) {
    const apiKey = await this.getClientApiKey(clientId);
    if (!apiKey) return null;
    try {
      const resp = await axios.get(`${this.baseUrl}/v2/campaigns`, {
        headers: { 'Api-Key': apiKey }
      });
      const campaigns = resp.data?.campaigns || resp.data?.result || [];
      if (Array.isArray(campaigns) && campaigns.length > 0) {
        return campaigns[0].id || campaigns[0].campaignId || campaigns[0].campaign?.id || null;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Получить business ID клиента
   * Для работы с API нужно знать business ID
   * Можно получить через API: GET /campaigns
   */
  async getBusinessId(clientId) {
    const client = await pool.connect();
    try {
      // Проверяем, есть ли сохраненный business_id в настройках клиента
      const result = await client.query(
        'SELECT api_keys FROM clients WHERE id = $1',
        [clientId]
      );

      if (result.rows.length === 0) {
        throw new Error('Client not found');
      }

      const apiKeys = result.rows[0].api_keys || {};
      // business_id может быть сохранен в api_keys.yandex_market.business_id
      // Если его нет, можно попробовать получить через API /campaigns
      const businessId = apiKeys.yandex_market?.business_id;
      
      if (businessId) {
        return businessId;
      }

      // Если business_id не указан, пытаемся получить через API
      const apiKey = await this.getClientApiKey(clientId);
      if (apiKey) {
        try {
          // Пытаемся получить через список кампаний
          const campaignsResponse = await axios.get(`${this.baseUrl}/campaigns`, { headers: { 'Api-Key': apiKey } });
          
          // Берем первый бизнес из списка
          const campaigns = campaignsResponse.data?.campaigns || [];
          if (campaigns.length > 0) {
            const firstBusinessId = campaigns[0].id || campaigns[0].businessId;
            // Сохраняем business_id в настройках для следующих раз
            await client.query(
              `UPDATE clients 
               SET api_keys = jsonb_set(
                 COALESCE(api_keys, '{}'::jsonb),
                 '{yandex_market,business_id}',
                 $1::jsonb
               )
               WHERE id = $2`,
              [JSON.stringify(firstBusinessId), clientId]
            );
            return firstBusinessId;
          }
        } catch (error) {
          // Если получили 401 или другой ответ, пробуем альтернативный endpoint бизнесов
          try {
            const businessesResponse = await axios.get(`${this.baseUrl}/businesses`, { headers: { 'Api-Key': apiKey } });
            const businesses = businessesResponse.data?.businesses || businessesResponse.data?.result || [];
            if (Array.isArray(businesses) && businesses.length > 0) {
              const firstBusinessId = businesses[0].businessId || businesses[0].id;
              if (firstBusinessId) {
                await client.query(
                  `UPDATE clients 
                   SET api_keys = jsonb_set(
                     COALESCE(api_keys, '{}'::jsonb),
                     '{yandex_market,business_id}',
                     $1::jsonb
                   )
                   WHERE id = $2`,
                  [JSON.stringify(firstBusinessId), clientId]
                );
                return firstBusinessId;
              }
            }
          } catch (e2) {
            // подавляем
          }
        }
      }

      return null;
    } finally {
      client.release();
    }
  }

  /**
   * Добавить товар на Яндекс Маркет
   * Документация: https://yandex.ru/dev/market/partner-api/doc/ru/reference/business-assortment/updateOfferMappings
   * 
   * @param {string} apiKey - API ключ Яндекс Маркета
   * @param {number} businessId - ID бизнеса/кампании на Яндекс Маркете
   * @param {Object} productData - Данные товара
   * @param {string} productData.offerId - SKU товара (offerId должен быть уникальным)
   * @param {string} productData.name - Название товара
   * @param {number} productData.marketCategoryId - ID категории на Яндекс Маркете
   * @param {Array<string>} productData.pictures - Массив URL изображений
   * @param {string} productData.vendor - Производитель/бренд
   * @param {string} productData.description - Описание товара
   * @param {number} productData.price - Цена товара
   * @param {string} language - Язык каталога (RU, EN, etc.)
   */
  async addProduct(apiKey, businessId, productData, language = 'RU') {
    try {
      const url = `${this.baseUrl}/v2/businesses/${businessId}/offer-mappings/update`;

      // Согласно step-by-step и спецификации метода, тело должно содержать массив offerMappings (1..500)
      // с минимумом полей: offer.offerId, offer.name, mapping.marketCategoryId, offer.pictures, offer.vendor, offer.description
      const requestBody = {
        offerMappings: [
          {
            offer: {
              offerId: productData.offerId,
              name: productData.name,
              vendor: productData.vendor || '',
              pictures: productData.pictures || [],
              description: productData.description || '',
              ...(Array.isArray(productData.parameterValues) && productData.parameterValues.length > 0
                ? { parameterValues: productData.parameterValues }
                : {}),
              ...(productData.price ? { price: { value: productData.price, currencyId: 'RUR' } } : {})
            },
            mapping: {
              marketCategoryId: productData.marketCategoryId
            }
          }
        ]
      };

      const response = await axios.post(url, requestBody, {
        headers: {
          'Api-Key': apiKey,
          'Content-Type': 'application/json'
        },
        params: {
          language: language
        },
        timeout: 30000
      });

      return response.data;
    } catch (error) {
      console.error('Yandex Market addProduct error:', error.response?.data || error.message);
      throw new Error(`Failed to add product to Yandex Market: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Получить дерево категорий Яндекс Маркета
   */
  async getCategoriesTree(apiKey, language = 'RU') {
    const url = `${this.baseUrl}/v2/categories/tree`;
    const response = await axios.post(url, {}, {
      headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
      params: { language },
      timeout: 30000
    });
    return response.data;
  }

  /**
   * Получить параметры листовой категории
   */
  async getCategoryParameters(apiKey, categoryId, businessId, language = 'RU') {
    const url = `${this.baseUrl}/v2/category/${categoryId}/parameters`;
    const response = await axios.post(url, { businessId }, {
      headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
      params: { language },
      timeout: 30000
    });
    return response.data;
  }

  /**
   * Обновить остатки товаров на Яндекс Маркете
   * Документация: https://yandex.ru/dev/market/partner-api/doc/ru/reference/stocks/updateStocks
   * 
   * @param {string} apiKey - API ключ Яндекс Маркета
   * @param {number} businessId - ID бизнеса/кампании
   * @param {Array<Object>} stocks - Массив остатков товаров
   * @param {string} stocks[].sku - SKU товара (offerId)
   * @param {number} stocks[].warehouseId - ID склада (по умолчанию 2003902)
   * @param {number} stocks[].items - Количество товара на складе
   */
  async updateStocks(apiKey, campaignId, stocks, warehouseId = 2003902) {
    try {
      const url = `${this.baseUrl}/v2/campaigns/${campaignId}/offers/stocks`;

      const requestBody = {
        skus: stocks.map(stock => ({
          sku: stock.sku,
          warehouseId: stock.warehouseId || warehouseId,
          items: [
            {
              type: 'FIT',
              count: stock.items || stock.count || 0,
              updatedAt: new Date().toISOString()
            }
          ]
        }))
      };

      const response = await axios.put(url, requestBody, {
        headers: {
          'Api-Key': apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      return response.data;
    } catch (error) {
      console.error('Yandex Market updateStocks error:', error.response?.data || error.message);
      throw new Error(`Failed to update stocks on Yandex Market: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Обновить цены товаров на Яндекс Маркете
   * 
   * @param {string} apiKey - API ключ Яндекс Маркета
   * @param {number} businessId - ID бизнеса/кампании
   * @param {Array<Object>} prices - Массив цен товаров
   * @param {string} prices[].offerId - SKU товара
   * @param {number} prices[].price - Цена товара
   */
  async updatePrices(apiKey, businessId, prices) {
    try {
      const url = `${this.baseUrl}/v2/businesses/${businessId}/offer-prices/updates`;

      const requestBody = {
        offers: prices.map(p => ({
          offerId: p.offerId,
          price: { value: p.price, currencyId: 'RUR' }
        }))
      };

      const response = await axios.post(url, requestBody, {
        headers: {
          'Api-Key': apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      return response.data;
    } catch (error) {
      console.error('Yandex Market updatePrices error:', error.response?.data || error.message);
      throw new Error(`Failed to update prices on Yandex Market: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Обновить цены в конкретном магазине (по campaignId)
   */
  async updateCampaignPrices(apiKey, campaignId, prices) {
    try {
      const url = `${this.baseUrl}/v2/campaigns/${campaignId}/offer-prices/updates`;
      const requestBody = {
        offers: prices.map(p => ({
          offerId: p.offerId,
          price: { value: p.price, currencyId: 'RUR' }
        }))
      };
      const response = await axios.post(url, requestBody, {
        headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
        timeout: 30000
      });
      return response.data;
    } catch (error) {
      console.error('Yandex Market updateCampaignPrices error:', error.response?.data || error.message);
      throw new Error(`Failed to update campaign prices on Yandex Market: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Получить категории Яндекс Маркета
   * Может быть полезно для определения marketCategoryId
   */
  async getCategories(apiKey, businessId) {
    try {
      const url = `${this.baseUrl}/v2/categories/tree`;

      const response = await axios.post(url, {}, {
        headers: {
          'Api-Key': apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      return response.data;
    } catch (error) {
      console.error('Yandex Market getCategories error:', error.response?.data || error.message);
      throw new Error(`Failed to get categories from Yandex Market: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Загрузить товар на Яндекс Маркет из товара магазина
   * 
   * @param {number} clientId - ID клиента
   * @param {number} productId - ID товара в wb_products_cache
   * @param {Object} options - Дополнительные опции
   * @param {number} options.marketCategoryId - ID категории на Яндекс Маркете
   */
  async uploadProductToMarket(clientId, productId, options = {}) {
    const client = await pool.connect();
    try {
      // Получаем API ключ и business ID
      const apiKey = await this.getClientApiKey(clientId);
      if (!apiKey) {
        throw new Error('Yandex Market API key is not configured');
      }

      const businessId = await this.getBusinessId(clientId);
      if (!businessId) {
        throw new Error('Yandex Market business ID is not configured. Please configure it in settings.');
      }

      // Получаем campaignId для обновления остатков
      const campaignId = await this.getCampaignId(clientId);

      // Получаем данные товара
      const productResult = await client.query(
        `SELECT * FROM wb_products_cache WHERE id = $1 AND client_id = $2`,
        [productId, clientId]
      );

      if (productResult.rows.length === 0) {
        throw new Error('Product not found');
      }

      const product = productResult.rows[0];

      // Вычисляем цену продажи с учетом наценки
      const purchasePrice = parseFloat(product.purchase_price) || 0;
      const markupPercent = parseFloat(product.markup_percent) || 0;
      const sellingPrice = purchasePrice * (1 + markupPercent / 100);

      // Подготавливаем данные для загрузки
      const productData = {
        offerId: product.article, // Используем артикул как SKU
        name: product.name,
        marketCategoryId: options.marketCategoryId || product.yandex_market_category_id || null,
        pictures: product.image_url ? [product.image_url] : [],
        vendor: product.brand || '',
        description: product.description || product.name,
        price: sellingPrice,
        parameterValues: Array.isArray(options.parameterValues) ? options.parameterValues : undefined
      };

      // Добавляем товар на Яндекс Маркет
      const result = await this.addProduct(apiKey, businessId, productData);

      // Устанавливаем цену через pricing API (после успешного добавления товара)
      if (sellingPrice && sellingPrice > 0) {
        try {
          if (campaignId) {
            try {
              await this.updateCampaignPrices(apiKey, campaignId, [
                { offerId: product.article, price: sellingPrice }
              ]);
            } catch (e) {
              const code = e?.response?.status;
              const msg = e?.response?.data || e?.message || '';
              // Fallback на бизнес-уровень, если магазинная цена недоступна
              if (code === 423 || (typeof msg === 'object' ? (msg.errors?.[0]?.code === 'LOCKED') : String(msg).includes('LOCKED'))) {
                await this.updatePrices(apiKey, businessId, [
                  { offerId: product.article, price: sellingPrice }
                ]);
              } else {
                throw e;
              }
            }
          } else {
            await this.updatePrices(apiKey, businessId, [
              { offerId: product.article, price: sellingPrice }
            ]);
          }
        } catch (priceErr) {
          console.error('Set price failed:', priceErr.message);
        }
      }

      // Обновляем данные товара в БД
      await client.query(
        `UPDATE wb_products_cache 
         SET yandex_market_sku = $1::text,
             marketplace_sync_status = jsonb_set(
               COALESCE(marketplace_sync_status, '{}'::jsonb),
               '{yandex_market}',
               jsonb_build_object(
                 'synced', true,
                 'last_sync', $2::timestamptz,
                 'sku', $1::text
               )
             ),
             marketplace_targets = CASE 
               WHEN NOT (COALESCE(marketplace_targets, '[]'::jsonb) ? 'yandex_market') 
               THEN COALESCE(marketplace_targets, '[]'::jsonb) || '["yandex_market"]'::jsonb
               ELSE COALESCE(marketplace_targets, '[]'::jsonb)
             END
         WHERE id = $3::int AND client_id = $4::int`,
        [
          product.article,
          new Date().toISOString(),
          productId,
          clientId
        ]
      );

      // Обновляем остатки (используем склад по умолчанию 2003902)
      if (campaignId && product.available_quantity && product.available_quantity > 0) {
        try {
          const warehouseId = await this.getClientWarehouseId(clientId);
          await this.updateStocks(apiKey, campaignId, [
            {
              sku: product.article,
              items: product.available_quantity,
              warehouseId: warehouseId ? Number(warehouseId) : undefined
            }
          ]);
        } catch (stockError) {
          console.error('Error updating stocks:', stockError);
          // Не прерываем выполнение, если остатки не обновились
        }
      }

      return {
        success: true,
        result: result,
        sku: product.article
      };
    } finally {
      client.release();
    }
  }
}

module.exports = YandexMarketService;

