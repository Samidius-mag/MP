const axios = require('axios');
const { pool } = require('../config/database');

class SimaLandService {
  constructor() {
    this.baseUrl = 'https://www.sima-land.ru/api/v3';
  }

  /**
   * Получить токен API клиента
   */
  async getClientToken(clientId) {
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
      return apiKeys.sima_land?.token;
    } finally {
      client.release();
    }
  }

  /**
   * Получить товары из API СИМА ЛЕНД
   * Документация: https://www.sima-land.ru/api/v3/help/
   */
  async fetchProducts(token, page = 1, perPage = 50) {
    try {
      console.log(`Fetching Sima-land products: page ${page}, perPage ${perPage}`);

      // Запрос на получение товаров из каталога
      // Используем правильный endpoint и заголовок x-api-key согласно документации
      const response = await axios.get(`${this.baseUrl}/item/`, {
        params: {
          'per-page': perPage,
          page: page
        },
        headers: {
          'x-api-key': token,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      return {
        items: response.data.items || [],
        total: response.data._meta?.totalCount || 0,
        pageCount: response.data._meta?.pageCount || 1,
        currentPage: response.data._meta?.currentPage || 1
      };
    } catch (error) {
      console.error('Sima-land API error:', error.response?.data || error.message);
      throw new Error(`Failed to fetch products: ${error.response?.statusText || error.message}`);
    }
  }

  /**
   * Получить остатки товаров
   * Попробуем разные endpoints для получения остатков
   */
  async fetchStock(token) {
    try {
      console.log('Fetching Sima-land stock');

      // Попробуем разные endpoints для остатков
      const endpoints = [
        '/inventory/',
        '/stock/',
        '/warehouse/',
        '/balance/'
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await axios.get(`${this.baseUrl}${endpoint}`, {
            headers: {
              'x-api-key': token,
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          });

          console.log(`✅ Successfully fetched stock from ${endpoint}`);
          return response.data.items || response.data || [];
        } catch (err) {
          // Не логируем каждую попытку, только при полном провале
          continue;
        }
      }

      // Если все endpoints не работают, это нормально - используем balance из товаров
      console.log('ℹ️ Stock API endpoints not available, will use balance from products');
      return [];
    } catch (error) {
      console.error('Sima-land stock API error:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Получить товары клиента из БД
   */
  async getClientProducts(clientId) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT id, article, name, brand, category, purchase_price, available_quantity, image_url, description
         FROM sima_land_products
         WHERE client_id = $1
         ORDER BY created_at DESC`,
        [clientId]
      );

      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Добавить товар клиента в каталог
   */
  async addClientProduct(clientId, productData) {
    const client = await pool.connect();
    try {
      // Проверяем, не существует ли уже товар с таким артикулом
      const existingProduct = await client.query(
        'SELECT id FROM sima_land_products WHERE client_id = $1 AND article = $2',
        [clientId, productData.article]
      );

      if (existingProduct.rows.length > 0) {
        // Обновляем существующий товар
        const updateResult = await client.query(
          `UPDATE sima_land_products 
           SET name = $3, brand = $4, category = $5, purchase_price = $6, 
               image_url = $7, description = $8, updated_at = NOW()
           WHERE client_id = $1 AND article = $2
           RETURNING id`,
          [
            clientId,
            productData.article,
            productData.name,
            productData.brand,
            productData.category,
            productData.purchase_price,
            productData.image_url,
            productData.description
          ]
        );

        return updateResult.rows[0].id;
      } else {
        // Создаем новый товар
        const insertResult = await client.query(
          `INSERT INTO sima_land_products 
           (client_id, article, name, brand, category, purchase_price, available_quantity, image_url, description)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id`,
          [
            clientId,
            productData.article,
            productData.name,
            productData.brand,
            productData.category,
            productData.purchase_price,
            0, // available_quantity по умолчанию 0
            productData.image_url,
            productData.description
          ]
        );

        return insertResult.rows[0].id;
      }
    } finally {
      client.release();
    }
  }

  /**
   * Загрузить и сохранить товары для клиента
   */
  async loadProductsForClient(clientId, token) {
    const client = await pool.connect();
    try {
      let allProducts = [];
      let page = 1;
      let totalPages = 1;

      // Загружаем все страницы товаров
      do {
        const result = await this.fetchProducts(token, page, 50);
        allProducts = allProducts.concat(result.items);
        totalPages = result.pageCount;
        page++;

        // Для первой загрузки ограничиваем до 20 страниц (1000 товаров)
        // Чтобы не было слишком долго
        if (page > 20) break;
      } while (page <= totalPages);

      console.log(`Fetched ${allProducts.length} products from Sima-land for client ${clientId}`);

      // Получаем остатки один раз для всех товаров
      let stockData = [];
      try {
        stockData = await this.fetchStock(token);
        console.log(`Fetched ${stockData.length} stock items`);
      } catch (err) {
        console.warn(`Could not fetch stock data:`, err.message);
      }

      // Сохраняем товары в БД
      let savedCount = 0;
      let imagesCount = 0;
      for (const product of allProducts) {
        try {
          // Получаем остаток для товара из загруженных данных
          let availableQuantity = 0;
          const productArticle = product.sid?.toString() || product.id?.toString() || '';
          
          if (productArticle && stockData.length > 0) {
            const stockItem = stockData.find(s => s.article === productArticle);
            if (stockItem) {
              availableQuantity = stockItem.available_quantity || stockItem.quantity || 0;
            }
          }
          
          // Если в stockData нет данных, используем balance из товара
          if (availableQuantity === 0 && product.balance) {
            availableQuantity = product.balance;
          }

          // Пробуем разные варианты полей для изображения
          // Согласно API СИМА ЛЕНД используются: img, photoUrl
          const imageUrl = product.img || 
                          product.photoUrl || 
                          product.image_url || 
                          product.imageUrl || 
                          product.image || 
                          product.photo || 
                          product.photo_url ||
                          product.picture ||
                          product.picture_url;
          
          if (imageUrl) imagesCount++;

          await client.query(
            `INSERT INTO sima_land_products 
             (client_id, article, name, brand, category, purchase_price, available_quantity, image_url, description)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (client_id, article) 
             DO UPDATE SET 
               name = EXCLUDED.name,
               brand = EXCLUDED.brand,
               category = EXCLUDED.category,
               purchase_price = EXCLUDED.purchase_price,
               available_quantity = EXCLUDED.available_quantity,
               image_url = EXCLUDED.image_url,
               description = EXCLUDED.description,
               updated_at = NOW()`,
            [
              clientId,
              productArticle,
              product.name,
              product.trademark?.name || product.brand,
              product.series?.name || product.category,
              product.price || product.purchase_price || 0,
              availableQuantity,
              imageUrl,
              product.stuff || product.description
            ]
          );

          savedCount++;
        } catch (err) {
          console.error(`Error saving product ${product.article || product.id}:`, err.message);
        }
      }

      console.log(`✅ Saved ${savedCount} products for client ${clientId}`);
      console.log(`📸 Found images for ${imagesCount} out of ${savedCount} products`);

      return {
        total: allProducts.length,
        saved: savedCount,
        images: imagesCount
      };
    } finally {
      client.release();
    }
  }
}

module.exports = SimaLandService;

