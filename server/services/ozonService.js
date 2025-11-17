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
  async getCategoryTree(apiKey, clientId) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/v2/category/tree`,
        {},
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
   */
  async getCategoryAttributes(apiKey, clientId, categoryId) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/v3/category/attribute`,
        {
          attribute_type: 'ALL',
          category_id: [Number(categoryId)],
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
   */
  mapCharacteristicsToOzon(characteristics, ozonAttributes) {
    const attributes = [];
    const attributeList = ozonAttributes?.result || ozonAttributes?.attributes || [];

    // Маппинг полей товара на атрибуты OZON
    const fieldMapping = {
      brand: ['бренд', 'brand', 'производитель'],
      color: ['цвет', 'color', 'колір'],
      size: ['размер', 'size', 'розмір'],
      material: ['материал', 'material', 'матеріал'],
      weight_kg: ['вес', 'weight', 'вага'],
      length_cm: ['длина', 'length', 'довжина'],
      width_cm: ['ширина', 'width', 'ширина'],
      height_cm: ['высота', 'height', 'висота']
    };

    for (const [fieldName, ozonNames] of Object.entries(fieldMapping)) {
      const value = characteristics[fieldName];
      if (!value) continue;

      // Ищем соответствующий атрибут в OZON
      const attrDef = attributeList.find(attr => {
        const attrName = (attr.name || attr.title || '').toLowerCase();
        return ozonNames.some(on => attrName.includes(on.toLowerCase()));
      });

      if (attrDef && value) {
        const attrValue = {
          id: attrDef.id,
          value: String(value)
        };
        // Если есть dictionary_id, можно добавить dictionary_value_id
        attributes.push(attrValue);
      }
    }

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

      // Получаем изображения товара
      let images = [];
      if (product.image_urls) {
        try {
          let imageUrlsArray = product.image_urls;
          if (typeof imageUrlsArray === 'string') {
            imageUrlsArray = JSON.parse(imageUrlsArray);
          }
          if (Array.isArray(imageUrlsArray) && imageUrlsArray.length > 0) {
            images = imageUrlsArray.filter(url => url && typeof url === 'string');
          }
        } catch (e) {
          console.warn('Failed to parse image_urls:', e.message);
        }
      }
      if (images.length === 0 && product.image_url) {
        images = [product.image_url];
      }

      if (images.length === 0) {
        throw new Error('At least one product image is required for OZON');
      }

      // Получаем атрибуты категории и маппим характеристики
      let attributes = [];
      const categoryId = options.categoryId;
      
      if (categoryId && characteristics && Object.keys(characteristics).length > 0) {
        try {
          const ozonAttributes = await this.getCategoryAttributes(
            credentials.apiKey,
            credentials.clientId,
            categoryId
          );
          attributes = this.mapCharacteristicsToOzon(characteristics, ozonAttributes);
        } catch (attrError) {
          console.warn('Failed to get or map category attributes:', attrError.message);
        }
      }

      // Если атрибуты переданы в options, используем их
      if (options.attributes && Array.isArray(options.attributes)) {
        attributes = options.attributes;
      }

      // Подготавливаем данные для импорта
      const productData = {
        offer_id: product.article, // Уникальный идентификатор товара
        name: product.name,
        category_id: Number(categoryId),
        price: String(sellingPrice.toFixed(2)), // Цена в рублях (строка)
        vat: '0', // НДС (0, 0.1, 0.2)
        description: product.description || product.name,
        images: images,
        attributes: attributes.length > 0 ? attributes : undefined,
        weight: product.weight_kg ? Math.round(product.weight_kg * 1000) : undefined, // Вес в граммах
        dimension_unit: 'mm',
        height: product.height_cm ? Math.round(product.height_cm * 10) : undefined, // Высота в мм
        length: product.length_cm ? Math.round(product.length_cm * 10) : undefined, // Длина в мм
        width: product.width_cm ? Math.round(product.width_cm * 10) : undefined // Ширина в мм
      };

      // Проверяем обязательные поля
      if (!productData.category_id) {
        throw new Error('OZON category ID is required');
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

