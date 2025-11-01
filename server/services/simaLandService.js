const axios = require('axios');
const { pool } = require('../config/database');

class SimaLandService {
  constructor() {
    this.baseUrl = 'https://www.sima-land.ru/api/v3';
  }

  async fetchCategories(token) {
    try {
      const response = await axios.get(`${this.baseUrl}/category/`, {
        params: { 'per-page': 1000 },
        headers: {
          'x-api-key': token,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      return response.data.items || [];
    } catch (error) {
      console.error('Sima-land categories API error:', error.response?.data || error.message);
      return [];
    }
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
  async fetchProducts(token, page = 1, perPage = 50, idGreaterThan = null, options = {}) {
    const maxRetries = 3;
    let attempt = 0;
    const makeRequest = async () => {
      const logPage = idGreaterThan ? `idGreaterThan ${idGreaterThan}` : `page ${page}`;
      console.log(`Fetching Sima-land products: ${logPage}, perPage ${perPage}`);

      // Запрос на получение товаров из каталога
      // Используем правильный endpoint и заголовок x-api-key согласно документации
      const params = {
        'per-page': perPage,
        ...(idGreaterThan ? { 'id-greater-than': idGreaterThan } : { page }),
      };
      if (options?.categories && Array.isArray(options.categories) && options.categories.length > 0) {
        // СИМА ЛЕНД обычно принимает category_id; пробуем передавать массив как CSV
        params['category_id'] = options.categories.join(',');
      }

      const response = await axios.get(`${this.baseUrl}/item/`, {
        params,
        headers: {
          'x-api-key': token,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: 30000,
        httpAgent: new (require('http').Agent)({ keepAlive: true }),
        httpsAgent: new (require('https').Agent)({ keepAlive: true })
      });

      return {
        items: response.data.items || [],
        total: response.data._meta?.totalCount || 0,
        pageCount: response.data._meta?.pageCount || 1,
        currentPage: response.data._meta?.currentPage || 1
      };
    };

    try {
      return await makeRequest();
    } catch (error) {
      // Обработка rate limit'ов и временных ошибок
      const status = error?.response?.status;
      if (status === 429 || status === 503 || status === 504) {
        const retryAfter = Number(error?.response?.headers?.['retry-after']) || 3;
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        return await makeRequest();
      }
      // Сетевые ошибки (ECONNRESET/ETIMEDOUT и т.п.) — повторим до 3 раз с экспоненциальной задержкой
      const transientCodes = ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENETUNREACH', 'ECONNREFUSED'];
      if (transientCodes.includes(error?.code) && attempt < maxRetries) {
        attempt++;
        const delayMs = 1000 * Math.pow(2, attempt); // 2s, 4s, 8s
        console.warn(`Transient error ${error.code}. Retry ${attempt}/${maxRetries} in ${delayMs}ms`);
        await new Promise(r => setTimeout(r, delayMs));
        return await makeRequest();
      }
      console.error('Sima-land API error:', error.response?.data || error.message);
      const wrapped = new Error(`Failed to fetch products: ${error.response?.statusText || error.message}`);
      if (error.response) wrapped.response = error.response; // preserve status for callers
      if (error.code) wrapped.code = error.code;
      throw wrapped;
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
  async loadProductsForClient(clientId, token, progressJobId, options = {}) {
    const progressStore = progressJobId ? require('./progressStore') : null;
    const client = await pool.connect();
    try {
      // Курсорная пагинация через id-greater-than (рекомендация API при больших оффсетах)
      const perPage = 100;
      let cursorId = null; // последний id в предыдущей пачке
      let batchIndex = 0;
      let totalFetched = 0;

      // Получаем остатки один раз для всех товаров
      let stockData = [];
      try {
        stockData = await this.fetchStock(token);
        console.log(`Fetched ${stockData.length} stock items`);
      } catch (err) {
        console.warn(`Could not fetch stock data:`, err.message);
      }

      // Сохраняем товары батчами, чтобы не держать всё в памяти
      let savedCount = 0;
      let imagesCount = 0;
      while (true) {
        batchIndex++;
        let result;
        try {
          result = await this.fetchProducts(token, 1, perPage, cursorId, options);
        } catch (e) {
          // Если возникла ошибка на page-офсете, принудительно переходим на курсорную пагинацию
          result = { items: [] };
        }

        const items = result.items || [];
        if (items.length === 0) break;
        totalFetched += items.length;

        if (progressStore && progressJobId) {
          // Прогресс без известного тотала — условный, не более 50%
          const pseudoProgress = Math.min(50, Math.floor(Math.log10(1 + totalFetched) * 20));
          progressStore.setProgress(progressJobId, pseudoProgress, {
            stage: 'fetching',
            batchIndex,
            batchSize: items.length,
            totalFetched
          });
        }

        for (let i = 0; i < items.length; i++) {
          const product = items[i];
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
          if (progressStore && progressJobId) {
            const base = 50; // первая половина — загрузка, вторая — сохранение
            const saveProgress = Math.min(50, Math.floor(Math.log10(1 + savedCount) * 20));
            progressStore.setProgress(progressJobId, base + saveProgress, {
              stage: 'saving',
              savedItems: savedCount,
              imagesWithUrl: imagesCount
            });
          }
        } catch (err) {
          console.error(`Error saving product ${product.article || product.id}:`, err.message);
        }
        }

        // Обновляем курсор последним id
        const last = items[items.length - 1];
        cursorId = last?.id || last?.sid || cursorId;
      }

      console.log(`✅ Saved ${savedCount} products for client ${clientId}`);
      console.log(`📸 Found images for ${imagesCount} out of ${savedCount} products`);

      const result = {
        total: savedCount,
        saved: savedCount,
        images: imagesCount
      };

      if (progressStore && progressJobId) {
        progressStore.finishJob(progressJobId, result);
      }
      return result;
    } finally {
      client.release();
    }
  }

  async loadCatalog(options = {}, progressJobId) {
    const progressStore = progressJobId ? require('./progressStore') : null;
    const client = await pool.connect();
    const token = process.env.SIMA_LAND_STATIC_TOKEN;
    if (!token) throw new Error('SIMA_LAND_STATIC_TOKEN is not set');
    try {
      console.log('🔄 Starting Sima-land catalog load', {
        categories: Array.isArray(options.categories) ? options.categories : [],
        jobId: progressJobId
      });
      const perPage = 200;
      let cursorId = null;
      let savedCount = 0;
      let batchIndex = 0;

      // Инкрементальный старт от максимального id в БД (если не включена полная синхронизация)
      const fullSync = options.fullSync === true;
      if (!fullSync) {
        try {
          const r = await client.query(`SELECT COALESCE(MAX(id),0) AS max_id FROM sima_land_catalog`);
          const maxId = r.rows[0]?.max_id;
          if (maxId && Number(maxId) > 0) {
            cursorId = Number(maxId);
            console.log(`↗️ Incremental start from idGreaterThan=${cursorId}`);
          }
        } catch {}
      } else {
        console.log(`🔄 Full sync mode: loading all products from the beginning`);
      }

      let buffer = [];
      const flush = async () => {
        if (buffer.length === 0) return;
        const cols = ['id','article','name','brand','category_id','category','purchase_price','available_quantity','image_url','description'];
        const values = [];
        const params = [];
        let p = 1;
        for (const it of buffer) {
          values.push(`($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++})`);
          params.push(it.id, it.article, it.name, it.brand, it.category_id, it.category, it.purchase_price, it.available_quantity, it.image_url, it.description);
        }
        const sql = `INSERT INTO sima_land_catalog (${cols.join(',')}) VALUES ${values.join(',')}
          ON CONFLICT (id) DO UPDATE SET
            article=EXCLUDED.article,
            name=EXCLUDED.name,
            brand=EXCLUDED.brand,
            category_id=EXCLUDED.category_id,
            category=EXCLUDED.category,
            purchase_price=EXCLUDED.purchase_price,
            available_quantity=EXCLUDED.available_quantity,
            image_url=EXCLUDED.image_url,
            description=EXCLUDED.description,
            updated_at=NOW()`;
        await client.query(sql, params);
        savedCount += buffer.length;
        buffer = [];
      };

      while (true) {
        batchIndex++;
        let result;
        try {
          result = await this.fetchProducts(token, 1, perPage, cursorId, options);
        } catch (e) {
          const status = e?.response?.status;
          if (status === 404) {
            console.warn('Sima-land: items not found (404). Treating as end of stream.');
            break;
          }
          console.warn(`Sima-land transient error on batch #${batchIndex}: ${e.message || e}`);
          // бэк-офф и продолжим ту же страницу
          await new Promise(r => setTimeout(r, 3000));
          batchIndex--; // повторим попытку с тем же номером
          continue;
        }
        const items = result.items || [];
        if (items.length === 0) break;

        for (const product of items) {
          const row = {
            id: product.id || product.sid,
            article: product.sid?.toString() || product.id?.toString() || '',
            name: product.name,
            brand: product.trademark?.name || product.brand,
            category_id: product.category_id || product.categoryId || null,
            category: product.series?.name || product.category,
            purchase_price: product.price || product.purchase_price || 0,
            available_quantity: product.balance || 0,
            image_url: (product.img || product.photoUrl || product.image_url || product.imageUrl || product.image || product.photo || product.photo_url || product.picture || product.picture_url) || null,
            description: product.stuff || product.description
          };
          buffer.push(row);
          if (buffer.length >= 500) {
            await flush();
            if (progressStore && progressJobId) {
              progressStore.setProgress(progressJobId, Math.min(100, Math.floor(Math.log10(1 + savedCount) * 25)), {
                stage: 'catalog-saving',
                savedItems: savedCount
              });
            }
          }
        }

        const last = items[items.length - 1];
        cursorId = last?.id || last?.sid || cursorId;

        console.log(`📦 Catalog batch #${batchIndex}: fetched=${items.length}, totalSaved=${savedCount + buffer.length}, cursor=${cursorId}`);
      }

      // финальный сброс буфера
      await flush();

      // Categories refresh (best effort)
      const cats = await this.fetchCategories(token);
      console.log(`📚 Categories fetched: ${cats.length}`);
      for (const c of cats) {
        try {
          await client.query(
            `INSERT INTO sima_land_categories (id, name, parent_id, level)
             VALUES ($1,$2,$3,$4)
             ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, parent_id=EXCLUDED.parent_id, level=EXCLUDED.level, updated_at=NOW()`,
            [c.id, c.name, c.parent_id || null, c.depth || null]
          );
        } catch {}
      }

      // Резервное наполнение категорий из каталога, если API вернуло 0
      if (!cats || cats.length === 0) {
        console.log('ℹ️ Categories API returned 0. Backfilling categories from catalog...');
        await client.query(
          `INSERT INTO sima_land_categories (id, name)
           SELECT DISTINCT category_id, COALESCE(category, 'Без категории')
           FROM sima_land_catalog
           WHERE category_id IS NOT NULL
           ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()`
        );
      }

      console.log(`✅ Catalog load completed: saved=${savedCount}`);
      if (progressStore && progressJobId) progressStore.finishJob(progressJobId, { saved: savedCount });
      return { saved: savedCount };
    } finally {
      client.release();
    }
  }
}

module.exports = SimaLandService;

