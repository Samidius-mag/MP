const axios = require('axios');
const { pool } = require('../config/database');

class OzonService {
  constructor() {
    this.baseUrl = 'https://api-seller.ozon.ru';
  }

  /**
   * Получить API ключ и Client ID клиента для OZON
   */
  async getClientCredentials(clientId) {
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
      return {
        apiKey: apiKeys.ozon?.api_key,
        clientId: apiKeys.ozon?.client_id
      };
    } finally {
      client.release();
    }
  }

  /**
   * Получить дерево категорий OZON
   * Документация: https://docs.ozon.ru/api/seller/#operation/ProductAPI_GetCategoryTree
   */
  async getCategoryTree(apiKey, clientId, language = 'RU') {
    try {
      const response = await axios.post(
        `${this.baseUrl}/v1/description-category/tree`,
        {
          language: language
        },
        {
          headers: {
            'Client-Id': clientId,
            'Api-Key': apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      return response.data;
    } catch (error) {
      console.error('OZON getCategoryTree error:', error.response?.data || error.message);
      throw new Error(`Failed to get categories from OZON: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Получить атрибуты категории OZON
   * Документация: https://docs.ozon.ru/api/seller/#operation/ProductAPI_GetProductAttributes
   * Используем актуальный метод /v1/description-category/attribute
   * 
   * @param {string} categoryId - Может быть как description_category_id, так и type_id
   * @param {boolean} isTypeId - Если true, то categoryId является type_id, иначе description_category_id
   * @param {number} parentCategoryId - Родительская категория (обязательна для type_id)
   */
  async getCategoryAttributes(apiKey, clientId, categoryId, isTypeId = false, parentCategoryId = null) {
    try {
      const requestBody = {
        language: 'RU'
      };

      // Если это type_id, передаем type_id и родительскую категорию
      if (isTypeId) {
        requestBody.type_id = Number(categoryId);
        if (parentCategoryId) {
          requestBody.description_category_id = Number(parentCategoryId);
        }
      } else {
        // Если это description_category_id, передаем только description_category_id
        requestBody.description_category_id = Number(categoryId);
      }

      const response = await axios.post(
        `${this.baseUrl}/v1/description-category/attribute`,
        requestBody,
        {
          headers: {
            'Client-Id': clientId,
            'Api-Key': apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      return response.data;
    } catch (error) {
      console.error('OZON getCategoryAttributes error:', error.response?.data || error.message);
      throw new Error(`Failed to get category attributes from OZON: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Получить значения атрибута (для словарных атрибутов)
   * Документация: https://docs.ozon.ru/api/seller/#operation/ProductAPI_GetProductAttributeValues
   */
  async getAttributeValues(apiKey, clientId, attributeId, categoryId, lastValueId = 0, limit = 100) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/v3/category/attribute/values`,
        {
          attribute_id: Number(attributeId),
          category_id: Number(categoryId),
          last_value_id: lastValueId,
          limit: limit,
          language: 'DEFAULT'
        },
        {
          headers: {
            'Client-Id': clientId,
            'Api-Key': apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      return response.data;
    } catch (error) {
      console.error('OZON getAttributeValues error:', error.response?.data || error.message);
      throw new Error(`Failed to get attribute values from OZON: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Импорт товара на OZON
   * Документация: https://docs.ozon.ru/api/seller/#operation/ProductAPI_ImportProducts
   */
  async importProduct(apiKey, clientId, productData) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/v3/product/import`,
        {
          items: [productData]
        },
        {
          headers: {
            'Client-Id': clientId,
            'Api-Key': apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 60000
        }
      );

      return response.data;
    } catch (error) {
      console.error('OZON importProduct error:', error.response?.data || error.message);
      throw new Error(`Failed to import product to OZON: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Получить информацию о статусе импорта
   * Документация: https://docs.ozon.ru/api/seller/#operation/ProductAPI_GetImportProductsInfo
   */
  async getImportInfo(apiKey, clientId, taskId) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/v1/product/import/info`,
        {
          task_id: Number(taskId)
        },
        {
          headers: {
            'Client-Id': clientId,
            'Api-Key': apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      return response.data;
    } catch (error) {
      console.error('OZON getImportInfo error:', error.response?.data || error.message);
      throw new Error(`Failed to get import info from OZON: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Маппить характеристики товара на атрибуты OZON
   * @param {Object} product - Товар из БД (с полями brand, weight_kg, и т.д.)
   * @param {Object} characteristics - Характеристики товара (JSONB)
   * @param {Array} ozonAttributes - Атрибуты категории OZON
   */
  mapCharacteristicsToOzon(product, characteristics, ozonAttributes) {
    const attributes = [];
    const attributeList = ozonAttributes?.result || ozonAttributes?.attributes || [];

    console.log(`[OZON] Mapping attributes: ${attributeList.length} OZON attributes available`);
    console.log(`[OZON] Product data: brand=${product.brand}, weight_kg=${product.weight_kg}, length_cm=${product.length_cm}, width_cm=${product.width_cm}, height_cm=${product.height_cm}`);
    console.log(`[OZON] Characteristics keys:`, characteristics ? Object.keys(characteristics).slice(0, 10) : 'null');

    // Объединяем данные из товара и характеристик
    const productData = {
      brand: product.brand || characteristics?.brand || characteristics?.trademark || characteristics?.['Бренд'] || characteristics?.['Производитель'],
      weight_kg: product.weight_kg || characteristics?.weight_kg || characteristics?.weight || characteristics?.['Вес'] || characteristics?.['Масса'],
      length_cm: product.length_cm || characteristics?.length_cm || characteristics?.length || characteristics?.['Длина'],
      width_cm: product.width_cm || characteristics?.width_cm || characteristics?.width || characteristics?.['Ширина'],
      height_cm: product.height_cm || characteristics?.height_cm || characteristics?.height || characteristics?.['Высота'],
      color: characteristics?.color || characteristics?.colour || characteristics?.['Цвет'],
      size: characteristics?.size || characteristics?.['Размер'],
      material: characteristics?.material || characteristics?.stuff || characteristics?.['Материал'],
      country: characteristics?.country || characteristics?.['Страна производства'] || characteristics?.['Страна'],
      // Дополнительные поля из характеристик
      ...(characteristics || {})
    };

    // Маппинг полей товара на атрибуты OZON
    const fieldMapping = {
      brand: ['бренд', 'brand', 'производитель', 'trademark', 'марка', 'марка товара'],
      color: ['цвет', 'color', 'колір', 'colour'],
      size: ['размер', 'size', 'розмір'],
      material: ['материал', 'material', 'матеріал', 'stuff', 'состав', 'состав материала'],
      weight_kg: ['вес', 'weight', 'вага', 'масса', 'вес товара', 'вес с упаковкой'],
      length_cm: ['длина', 'length', 'довжина', 'длина упаковки'],
      width_cm: ['ширина', 'width', 'ширина упаковки'],
      height_cm: ['высота', 'height', 'висота', 'высота упаковки'],
      country: ['страна', 'country', 'страна производства', 'country_of_origin', 'страна-изготовитель']
    };

    for (const [fieldName, ozonNames] of Object.entries(fieldMapping)) {
      let value = productData[fieldName];
      if (!value) {
        console.log(`[OZON] Field ${fieldName}: no value found`);
        continue;
      }

      // Преобразуем значение в строку и очищаем
      if (typeof value === 'object' && value !== null) {
        // Если это объект (например, {name: "Brand"}), извлекаем name
        value = value.name || value.title || String(value);
      }
      value = String(value).trim();
      if (!value || value === 'null' || value === 'undefined') {
        console.log(`[OZON] Field ${fieldName}: empty after processing`);
        continue;
      }

      console.log(`[OZON] Looking for attribute for ${fieldName} = ${value}`);

      // Ищем соответствующий атрибут в OZON
      const attrDef = attributeList.find(attr => {
        const attrName = (attr.name || attr.title || attr.dictionary_name || attr.description || '').toLowerCase();
        return ozonNames.some(on => {
          const searchTerm = on.toLowerCase();
          // Более гибкий поиск
          return attrName.includes(searchTerm) || 
                 searchTerm.includes(attrName) ||
                 attrName === searchTerm ||
                 attrName.replace(/\s+/g, '') === searchTerm.replace(/\s+/g, '');
        });
      });

      if (attrDef && value) {
        console.log(`[OZON] Found attribute for ${fieldName}: ${attrDef.name || attrDef.title} (id: ${attrDef.id})`);
        
        // Для веса преобразуем кг в граммы, если нужно
        if (fieldName === 'weight_kg') {
          const weightNum = parseFloat(value);
          if (!isNaN(weightNum)) {
            value = String(Math.round(weightNum * 1000)); // кг -> граммы
            console.log(`[OZON] Converted weight: ${weightNum} kg -> ${value} g`);
          }
        }
        
        // Для размеров преобразуем см в мм, если нужно
        if ((fieldName === 'length_cm' || fieldName === 'width_cm' || fieldName === 'height_cm')) {
          const sizeNum = parseFloat(value);
          if (!isNaN(sizeNum)) {
            value = String(Math.round(sizeNum * 10)); // см -> мм
            console.log(`[OZON] Converted ${fieldName}: ${sizeNum} cm -> ${value} mm`);
          }
        }

        const attrValue = {
          id: attrDef.id,
          value: String(value)
        };
        attributes.push(attrValue);
        console.log(`[OZON] Added attribute: ${attrDef.name || attrDef.title} = ${value}`);
      } else {
        console.warn(`[OZON] No matching attribute found for ${fieldName} = ${value}`);
        // Логируем доступные атрибуты для отладки
        if (fieldName === 'brand' || fieldName === 'weight_kg') {
          console.log(`[OZON] Available OZON attributes (first 10):`, 
            attributeList.slice(0, 10).map(a => a.name || a.title || a.id).join(', '));
        }
      }
    }

    console.log(`[OZON] Total mapped attributes: ${attributes.length}`);
    return attributes;
  }

  /**
   * Загрузить товар на OZON из товара магазина
   */
  async uploadProductToMarket(clientId, productId, options = {}) {
    const client = await pool.connect();
    try {
      // Получаем API ключ и Client ID
      const credentials = await this.getClientCredentials(clientId);
      if (!credentials.apiKey || !credentials.clientId) {
        throw new Error('OZON API key or Client ID is not configured');
      }

      // Получаем данные товара
      const productResult = await client.query(
        `SELECT * FROM wb_products_cache WHERE id = $1 AND client_id = $2`,
        [productId, clientId]
      );

      if (productResult.rows.length === 0) {
        throw new Error('Product not found');
      }

      const product = productResult.rows[0];
      
      // Логируем структуру данных товара для отладки
      console.log(`[OZON] Product ${product.article} data:`, {
        id: product.id,
        article: product.article,
        name: product.name,
        brand: product.brand,
        weight_kg: product.weight_kg,
        length_cm: product.length_cm,
        width_cm: product.width_cm,
        height_cm: product.height_cm,
        image_url: product.image_url ? product.image_url.substring(0, 100) : 'NULL',
        image_urls_type: typeof product.image_urls,
        image_urls_is_array: Array.isArray(product.image_urls),
        image_urls_length: Array.isArray(product.image_urls) ? product.image_urls.length : 'N/A',
        characteristics_type: typeof product.characteristics,
        source: product.source
      });

      // Парсим характеристики
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

      // Вычисляем цену продажи с учетом наценки
      const purchasePrice = parseFloat(product.purchase_price) || 0;
      const markupPercent = parseFloat(product.markup_percent) || 0;
      const sellingPrice = purchasePrice * (1 + markupPercent / 100);

      if (!sellingPrice || sellingPrice <= 0) {
        throw new Error(`Invalid selling price: ${sellingPrice}. Purchase price: ${purchasePrice}, markup: ${markupPercent}%`);
      }

      // Получаем изображения товара и валидируем URL
      let images = [];
      
      // Функция для преобразования относительного URL в абсолютный
      const normalizeImageUrl = (url) => {
        if (!url || typeof url !== 'string') return null;
        
        try {
          // Если URL уже абсолютный, просто валидируем его
          const urlObj = new URL(url);
          return urlObj.href;
        } catch (e) {
          // Если URL относительный, пытаемся преобразовать его в абсолютный
          // Проверяем, является ли это прокси URL
          if (url.startsWith('/api/')) {
            // Это относительный URL прокси - нужно получить базовый URL
            // Для OZON нужны абсолютные URL, поэтому извлекаем оригинальный URL из прокси
            try {
              const urlParams = new URLSearchParams(url.split('?')[1] || '');
              const originalUrl = urlParams.get('url');
              if (originalUrl) {
                // Декодируем URL параметр
                const decodedUrl = decodeURIComponent(originalUrl);
                const urlObj = new URL(decodedUrl);
                return urlObj.href;
              }
            } catch (e2) {
              console.warn(`[OZON] Failed to extract URL from proxy: ${url}`, e2.message);
            }
          }
          
          // Если не удалось преобразовать, пропускаем
          console.warn(`[OZON] Invalid image URL: ${url}`);
          return null;
        }
      };
      
      // Логируем исходные данные для отладки
      console.log(`[OZON] Product ${product.article}: image_urls type = ${typeof product.image_urls}, image_url = ${product.image_url || 'NULL'}`);
      
      // Обрабатываем image_urls - может быть массивом, строкой JSON, или объектом
      if (product.image_urls) {
        try {
          let imageUrlsArray = product.image_urls;
          
          // Если это строка, парсим JSON
          if (typeof imageUrlsArray === 'string') {
            imageUrlsArray = JSON.parse(imageUrlsArray);
          }
          
          // Если это объект (не массив), пытаемся преобразовать в массив
          if (imageUrlsArray && typeof imageUrlsArray === 'object' && !Array.isArray(imageUrlsArray)) {
            // Пробуем извлечь значения из объекта
            const values = Object.values(imageUrlsArray);
            if (values.length > 0 && values.every(v => typeof v === 'string')) {
              imageUrlsArray = values;
            } else {
              // Если это не массив строк, пробуем найти массив внутри объекта
              const arrayKeys = Object.keys(imageUrlsArray).filter(k => Array.isArray(imageUrlsArray[k]));
              if (arrayKeys.length > 0) {
                imageUrlsArray = imageUrlsArray[arrayKeys[0]];
              } else {
                imageUrlsArray = [];
              }
            }
          }
          
          console.log(`[OZON] Product ${product.article}: image_urls array length = ${Array.isArray(imageUrlsArray) ? imageUrlsArray.length : 'not array'}`);
          
          if (Array.isArray(imageUrlsArray) && imageUrlsArray.length > 0) {
            // Обрабатываем все изображения из массива
            images = imageUrlsArray
              .map((url, index) => {
                if (!url) return null;
                const normalized = normalizeImageUrl(url);
                if (!normalized) {
                  console.warn(`[OZON] Product ${product.article}: Failed to normalize image ${index + 1}: ${url}`);
                } else {
                  console.log(`[OZON] Product ${product.article}: Image ${index + 1} normalized: ${normalized.substring(0, 80)}...`);
                }
                return normalized;
              })
              .filter(url => url !== null);
            
            console.log(`[OZON] Product ${product.article}: Normalized ${images.length} images from ${imageUrlsArray.length} URLs`);
          } else {
            console.warn(`[OZON] Product ${product.article}: image_urls is not an array or empty`);
            if (product.image_urls) {
              console.warn(`[OZON] Product ${product.article}: image_urls structure:`, JSON.stringify(product.image_urls).substring(0, 200));
            }
          }
        } catch (e) {
          console.warn(`[OZON] Failed to parse image_urls for product ${product.article}:`, e.message);
          console.warn(`[OZON] Raw image_urls type:`, typeof product.image_urls);
          console.warn(`[OZON] Raw image_urls:`, product.image_urls);
        }
      } else {
        console.warn(`[OZON] Product ${product.article}: image_urls is null or undefined`);
      }
      
      // Если изображений из массива нет, пробуем взять из image_url
      if (images.length === 0 && product.image_url) {
        console.log(`[OZON] Product ${product.article}: Using image_url as fallback`);
        const normalizedUrl = normalizeImageUrl(product.image_url);
        if (normalizedUrl) {
          images = [normalizedUrl];
        }
      }

      // Логируем финальное количество изображений
      console.log(`[OZON] Product ${product.article}: Final images count = ${images.length}`);
      if (images.length > 0) {
        console.log(`[OZON] Product ${product.article}: First image = ${images[0].substring(0, 100)}...`);
      }

      if (images.length === 0) {
        throw new Error('At least one valid product image URL is required for OZON');
      }

      // Получаем атрибуты категории и маппим характеристики
      let attributes = [];
      const categoryId = options.categoryId;
      const isTypeId = options.isTypeId || false;
      const parentCategoryId = options.parentCategoryId || null;
      
      // Получаем атрибуты категории, если указана категория
      if (categoryId) {
        try {
          const ozonAttributes = await this.getCategoryAttributes(
            credentials.apiKey,
            credentials.clientId,
            categoryId,
            isTypeId,
            parentCategoryId
          );
          // Маппим характеристики товара на атрибуты OZON
          // Передаем и товар (для прямых полей), и characteristics
          attributes = this.mapCharacteristicsToOzon(product, characteristics, ozonAttributes);
          console.log(`[OZON] Mapped ${attributes.length} attributes from product data`);
        } catch (attrError) {
          console.warn('Failed to get or map category attributes:', attrError.message);
        }
      }

      // Если атрибуты переданы в options, объединяем их с автоматически найденными
      if (options.attributes && Array.isArray(options.attributes)) {
        // Объединяем автоматически найденные атрибуты с переданными вручную
        // Приоритет у переданных вручную (они могут перезаписать автоматические)
        const manualAttrIds = new Set(options.attributes.map(a => a.id));
        // Удаляем автоматические атрибуты, которые были переопределены вручную
        attributes = attributes.filter(a => !manualAttrIds.has(a.id));
        // Добавляем переданные вручную атрибуты
        attributes = [...attributes, ...options.attributes];
      }

      // Подготавливаем данные для импорта
      const productData = {
        offer_id: product.article, // Уникальный идентификатор товара
        name: product.name,
        price: String(sellingPrice.toFixed(2)), // Цена в рублях (строка)
        vat: '0', // НДС (0, 0.1, 0.2)
        description: product.description || product.name,
        images: images, // Все изображения из массива
        attributes: attributes.length > 0 ? attributes : undefined,
        weight: product.weight_kg ? Math.round(product.weight_kg * 1000) : undefined, // Вес в граммах
        dimension_unit: 'mm',
        height: product.height_cm ? Math.round(product.height_cm * 10) : undefined, // Высота в мм
        length: product.length_cm ? Math.round(product.length_cm * 10) : undefined, // Длина в мм
        width: product.width_cm ? Math.round(product.width_cm * 10) : undefined // Ширина в мм
      };
      
      // Логируем финальные данные для импорта
      console.log(`[OZON] Product ${product.article} import data:`, {
        offer_id: productData.offer_id,
        name: productData.name.substring(0, 50) + '...',
        price: productData.price,
        images_count: productData.images.length,
        attributes_count: productData.attributes ? productData.attributes.length : 0,
        weight: productData.weight,
        dimensions: {
          length: productData.length,
          width: productData.width,
          height: productData.height
        }
      });

      // Если это type_id, используем ОБА параметра: description_category_id и type_id
      if (isTypeId) {
        productData.type_id = Number(categoryId);
        if (parentCategoryId) {
          productData.description_category_id = Number(parentCategoryId);
        }
      } else {
        productData.description_category_id = Number(categoryId);
      }

      // Проверяем обязательные поля
      if (!categoryId) {
        throw new Error('OZON category ID or type ID is required');
      }

      // Импортируем товар
      const importResult = await this.importProduct(
        credentials.apiKey,
        credentials.clientId,
        productData
      );

      // Обновляем данные товара в БД
      // Используем marketplace_sync_status для хранения информации о синхронизации с OZON
      await client.query(
        `UPDATE wb_products_cache 
         SET marketplace_sync_status = jsonb_set(
               COALESCE(marketplace_sync_status, '{}'::jsonb),
               '{ozon}',
               jsonb_build_object(
                 'synced', true,
                 'last_sync', $1::timestamptz,
                 'sku', $2::text,
                 'task_id', $3::text
               )
             ),
             marketplace_targets = CASE 
               WHEN NOT (COALESCE(marketplace_targets, '[]'::jsonb) ? 'ozon') 
               THEN COALESCE(marketplace_targets, '[]'::jsonb) || '["ozon"]'::jsonb
               ELSE COALESCE(marketplace_targets, '[]'::jsonb)
             END
         WHERE id = $4::int AND client_id = $5::int`,
        [
          new Date().toISOString(),
          product.article,
          importResult?.result?.task_id?.toString() || null,
          productId,
          clientId
        ]
      );

      return {
        success: true,
        result: importResult,
        taskId: importResult?.result?.task_id,
        sku: product.article
      };
    } finally {
      client.release();
    }
  }
}

module.exports = OzonService;

