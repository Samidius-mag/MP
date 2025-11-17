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
      // ВАЖНО: price НЕ должен передаваться в offer-mappings! Цена передается отдельно через pricing API.
      
      // Проверяем и улучшаем описание
      let description = productData.description || '';
      if (!description || description.trim().length < 50) {
        // Генерируем базовое описание, если его нет или оно слишком короткое
        const parts = [productData.name];
        if (productData.vendor) parts.push(`Бренд: ${productData.vendor}`);
        if (productData.category) parts.push(`Категория: ${productData.category}`);
        description = parts.join('. ') + '.';
      }
      
      // Формируем объект offer с обязательными и опциональными полями
      const offer = {
        offerId: productData.offerId,
        name: productData.name,
        vendor: productData.vendor || '',
        pictures: productData.pictures || [],
        description: description
      };

      // Добавляем параметры, если они есть
      if (Array.isArray(productData.parameterValues) && productData.parameterValues.length > 0) {
        offer.parameterValues = productData.parameterValues;
      }

      // Добавляем габариты и вес, если они есть
      if (productData.dimensions && Object.keys(productData.dimensions).length > 0) {
        offer.dimensions = productData.dimensions;
      }

      const requestBody = {
        offerMappings: [
          {
            offer: offer,
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
    console.log('[YM] GET categories.tree request');
    const response = await axios.post(url, {}, {
      headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
      params: { language },
      timeout: 30000
    });
    console.log('[YM] categories.tree ok');
    return response.data;
  }

  /**
   * Получить параметры листовой категории
   */
  async getCategoryParameters(apiKey, categoryId, businessId, language = 'RU') {
    const url = `${this.baseUrl}/v2/category/${categoryId}/parameters`;
    console.log('[YM] GET category.parameters request');
    const response = await axios.post(url, { businessId }, {
      headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
      params: { language },
      timeout: 30000
    });
    console.log('[YM] category.parameters ok');
    return response.data;
  }

  /**
   * Маппить характеристики товара Sima Land на параметры Яндекс.Маркет
   * @param {Object} characteristics - Характеристики товара из БД
   * @param {Object} yandexParameters - Параметры категории из Яндекс.Маркет
   * @returns {Array} Массив parameterValues для Яндекс.Маркет
   */
  mapCharacteristicsToYandexMarket(characteristics, yandexParameters) {
    if (!characteristics || typeof characteristics !== 'object') {
      return [];
    }

    const parameterValues = [];
    const paramDefs = yandexParameters?.result?.parameterDefinitions || yandexParameters?.parameterDefinitions || [];

    // Маппинг основных полей
    const fieldMapping = {
      'color': ['Цвет', 'color', 'Colour', 'цвет'],
      'size': ['Размер', 'size', 'Size', 'размер'],
      'material': ['Материал', 'material', 'Материал изготовления', 'Material'],
      'weight': ['Вес', 'weight', 'Weight', 'вес'],
      'country': ['Страна', 'country', 'Страна производства', 'Country'],
      'age': ['Возраст', 'age', 'Возрастная группа', 'Age'],
      'gender': ['Пол', 'gender', 'Половая принадлежность', 'Gender']
    };

    // Проходим по известным полям
    for (const [fieldName, yandexNames] of Object.entries(fieldMapping)) {
      if (!characteristics[fieldName]) continue;

      const value = characteristics[fieldName];
      // Ищем соответствующий параметр в Яндекс.Маркет
      const paramDef = paramDefs.find(param => {
        const paramName = (param.name || '').toLowerCase();
        return yandexNames.some(yn => paramName.includes(yn.toLowerCase()));
      });

      if (paramDef && value) {
        // Проверяем, есть ли словарь значений для этого параметра
        if (paramDef.dictionaryValues && Array.isArray(paramDef.dictionaryValues)) {
          // Пытаемся найти значение в словаре
          const dictValue = paramDef.dictionaryValues.find(dv => {
            const dvName = (dv.name || '').toLowerCase();
            const valueStr = String(value).toLowerCase();
            return dvName.includes(valueStr) || valueStr.includes(dvName);
          });

          if (dictValue) {
            parameterValues.push({
              parameterId: paramDef.id,
              valueId: dictValue.id
            });
          } else {
            // Используем текстовое значение, если словарное не найдено
            parameterValues.push({
              parameterId: paramDef.id,
              value: String(value)
            });
          }
        } else {
          // Параметр без словаря - используем текстовое значение
          parameterValues.push({
            parameterId: paramDef.id,
            value: String(value)
          });
        }
      }
    }

    // Обрабатываем массив parameters (если есть)
    if (Array.isArray(characteristics.parameters)) {
      for (const param of characteristics.parameters) {
        if (!param || !param.name) continue;

        const paramName = String(param.name).toLowerCase();
        const paramValue = param.value || param.val || param.text;

        // Ищем параметр в Яндекс.Маркет по имени
        const paramDef = paramDefs.find(yp => {
          const ypName = (yp.name || '').toLowerCase();
          return ypName.includes(paramName) || paramName.includes(ypName);
        });

        if (paramDef && paramValue) {
          // Проверяем, не добавили ли мы уже этот параметр
          const alreadyAdded = parameterValues.find(pv => pv.parameterId === paramDef.id);
          if (!alreadyAdded) {
            if (paramDef.dictionaryValues && Array.isArray(paramDef.dictionaryValues)) {
              const dictValue = paramDef.dictionaryValues.find(dv => {
                const dvName = (dv.name || '').toLowerCase();
                const valueStr = String(paramValue).toLowerCase();
                return dvName.includes(valueStr) || valueStr.includes(dvName);
              });

              if (dictValue) {
                parameterValues.push({
                  parameterId: paramDef.id,
                  valueId: dictValue.id
                });
              } else {
                parameterValues.push({
                  parameterId: paramDef.id,
                  value: String(paramValue)
                });
              }
            } else {
              parameterValues.push({
                parameterId: paramDef.id,
                value: String(paramValue)
              });
            }
          }
        }
      }
    }

    return parameterValues;
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
      // Сохраняем response в ошибке для последующей обработки
      const errorData = error.response?.data || {};
      const errorMessage = errorData.message || error.message || 'Unknown error';
      const lockedError = new Error(`Failed to update campaign prices on Yandex Market: ${errorMessage}`);
      lockedError.response = error.response;
      lockedError.statusCode = error.response?.status;
      lockedError.errorData = errorData;
      throw lockedError;
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
      
      // PostgreSQL автоматически конвертирует JSONB в объект, но проверим
      if (product.characteristics && typeof product.characteristics === 'string') {
        try {
          product.characteristics = JSON.parse(product.characteristics);
        } catch (e) {
          console.warn('Failed to parse characteristics:', e.message);
          product.characteristics = null;
        }
      }
      
      // Если characteristics пустой объект или null, устанавливаем в null
      if (product.characteristics && typeof product.characteristics === 'object' && Object.keys(product.characteristics).length === 0) {
        product.characteristics = null;
      }

      // Вычисляем цену продажи с учетом наценки
      const purchasePrice = parseFloat(product.purchase_price) || 0;
      const markupPercent = parseFloat(product.markup_percent) || 0;
      const sellingPrice = purchasePrice * (1 + markupPercent / 100);

      // Проверяем, что цена валидна
      if (!sellingPrice || sellingPrice <= 0) {
        throw new Error(`Invalid selling price: ${sellingPrice}. Purchase price: ${purchasePrice}, markup: ${markupPercent}%`);
      }

      // Получаем характеристики товара из БД
      let characteristics = null;
      if (product.characteristics) {
        try {
          characteristics = typeof product.characteristics === 'string' 
            ? JSON.parse(product.characteristics) 
            : product.characteristics;
        } catch (e) {
          console.warn('Failed to parse product characteristics:', e.message);
        }
      }

      // Маппинг характеристик на параметры Яндекс.Маркет
      let parameterValues = Array.isArray(options.parameterValues) ? options.parameterValues : undefined;
      
      // Если характеристик нет в options, но есть в БД и указана категория - получаем параметры категории и маппим
      if (!parameterValues && characteristics && Object.keys(characteristics).length > 0) {
        const marketCategoryId = options.marketCategoryId || product.yandex_market_category_id;
        
        if (marketCategoryId) {
          try {
            console.log(`[YM] Getting category parameters for category ${marketCategoryId}`);
            const yandexParameters = await this.getCategoryParameters(apiKey, marketCategoryId, businessId);
            parameterValues = this.mapCharacteristicsToYandexMarket(characteristics, yandexParameters);
            console.log(`[YM] Mapped ${parameterValues.length} characteristics to Yandex Market parameters`);
          } catch (paramError) {
            console.warn('[YM] Failed to get or map category parameters:', paramError.message);
            // Продолжаем без параметров, не критично
          }
        }
      }

      // Получаем все изображения товара
      let pictures = [];
      if (product.image_urls) {
        try {
          // image_urls может быть JSONB (объект) или строка
          let imageUrlsArray = product.image_urls;
          if (typeof imageUrlsArray === 'string') {
            imageUrlsArray = JSON.parse(imageUrlsArray);
          }
          if (Array.isArray(imageUrlsArray) && imageUrlsArray.length > 0) {
            pictures = imageUrlsArray.filter(url => url && typeof url === 'string');
          }
        } catch (e) {
          console.warn('Failed to parse image_urls:', e.message);
        }
      }
      // Если image_urls пустой, используем image_url как fallback
      if (pictures.length === 0 && product.image_url) {
        pictures = [product.image_url];
      }

      // Получаем габариты и вес товара
      let dimensions = null;
      if (product.length_cm || product.width_cm || product.height_cm || product.weight_kg) {
        dimensions = {};
        if (product.length_cm) dimensions.length = parseFloat(product.length_cm);
        if (product.width_cm) dimensions.width = parseFloat(product.width_cm);
        if (product.height_cm) dimensions.height = parseFloat(product.height_cm);
        if (product.weight_kg) dimensions.weight = parseFloat(product.weight_kg);
      }

      // Подготавливаем данные для загрузки
      const productData = {
        offerId: product.article, // Используем артикул как SKU
        name: product.name,
        marketCategoryId: options.marketCategoryId || product.yandex_market_category_id || null,
        pictures: pictures,
        vendor: product.brand || '',
        description: product.description || null, // Передаем null, метод addProduct сгенерирует описание если нужно
        category: product.category || null,
        parameterValues: parameterValues && parameterValues.length > 0 ? parameterValues : undefined,
        dimensions: dimensions
      };

      // Проверяем обязательные поля
      if (!productData.marketCategoryId) {
        throw new Error('Yandex Market category ID is required. Please set marketCategoryId in options or product.yandex_market_category_id');
      }
      
      if (!productData.pictures || productData.pictures.length === 0) {
        throw new Error('At least one product image is required for Yandex Market');
      }

      // Добавляем товар на Яндекс Маркет
      const result = await this.addProduct(apiKey, businessId, productData);

      // Устанавливаем цену через pricing API (обязательно после успешного добавления товара)
      // Цена НЕ передается в offer-mappings, только через отдельный pricing API
      let priceSet = false;
      try {
        if (campaignId) {
          try {
            await this.updateCampaignPrices(apiKey, campaignId, [
              { offerId: product.article, price: sellingPrice }
            ]);
            priceSet = true;
            console.log(`✅ Price set via campaign API for product ${product.article}`);
          } catch (e) {
            const statusCode = e?.statusCode || e?.response?.status;
            const errorData = e?.errorData || e?.response?.data || {};
            const errors = errorData.errors || [];
            const hasLockedError = errors.some(err => err.code === 'LOCKED') || 
                                   errorData.status === 'ERROR' && errors.some(err => err.code === 'LOCKED');
            
            // Fallback на бизнес-уровень, если магазинная цена недоступна (LOCKED или 423)
            if (statusCode === 423 || hasLockedError) {
              console.log(`⚠️  Campaign price locked, using business-level pricing for product ${product.article}`);
              try {
                await this.updatePrices(apiKey, businessId, [
                  { offerId: product.article, price: sellingPrice }
                ]);
                priceSet = true;
                console.log(`✅ Price set via business API for product ${product.article}`);
              } catch (businessErr) {
                console.error('Failed to set price via business API:', businessErr.message);
                throw businessErr;
              }
            } else {
              throw e;
            }
          }
        } else {
          await this.updatePrices(apiKey, businessId, [
            { offerId: product.article, price: sellingPrice }
          ]);
          priceSet = true;
          console.log(`✅ Price set via business API for product ${product.article}`);
        }
      } catch (priceErr) {
        console.error('Set price failed:', priceErr.message);
        console.error('Price error details:', priceErr.response?.data || priceErr.errorData || priceErr);
        
        // Если цена не установлена, это не критично - товар уже добавлен
        // Логируем предупреждение, но не прерываем процесс
        console.warn(`⚠️  Warning: Price could not be set for product ${product.article}, but product was added to Yandex Market`);
        console.warn(`   You may need to set the price manually in Yandex Market dashboard`);
      }
      
      if (!priceSet) {
        console.warn(`⚠️  Price was not set for product ${product.article}. Please set it manually in Yandex Market.`);
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

      // Обновляем остатки (всегда передаем, даже если 0)
      if (campaignId) {
        try {
          const warehouseId = await this.getClientWarehouseId(clientId);
          const availableQuantity = product.available_quantity || 0;
          
          await this.updateStocks(apiKey, campaignId, [
            {
              sku: product.article,
              items: availableQuantity,
              warehouseId: warehouseId ? Number(warehouseId) : undefined
            }
          ]);
          console.log(`✅ Stocks updated for product ${product.article}: ${availableQuantity} items`);
        } catch (stockError) {
          console.error('Error updating stocks:', stockError);
          console.error('Stock error details:', stockError.response?.data || stockError.message);
          // Не прерываем выполнение, если остатки не обновились
        }
      } else {
        console.warn(`⚠️  Campaign ID not found, stocks were not updated for product ${product.article}`);
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

