const axios = require('axios');
const { pool } = require('../config/database');

class SimaLandService {
  constructor() {
    this.baseUrl = 'https://www.sima-land.ru/api/v3';
  }

  /**
   * Парсинг товара из API sima-land v3
   * Правильный парсер на основе официальной документации API v3
   * @param {Object} product - Объект товара из API
   * @param {Array} stockData - Массив данных об остатках (опционально)
   * @returns {Object} - Распарсенные данные товара
   */
  parseProduct(product, stockData = []) {
    if (!product || typeof product !== 'object') {
      return null;
    }

    // ID товара - приоритет id, затем sid
    const id = product.id || product.sid || null;

    // Артикул (SID - служебный идентификатор) - это основной артикул товара
    const article = product.sid?.toString() || 
                   product.article?.toString() || 
                   product.id?.toString() || 
                   '';

    // Название товара
    const name = product.name || 
                 product.title || 
                 product.full_name || 
                 'Без названия';

    // Бренд - из объекта trademark или прямого поля brand
    const brand = product.trademark?.name || 
                  product.brand?.name || 
                  product.brand || 
                  null;

    // Категория - правильное поле для категории (не series!)
    // API v3 может возвращать категорию в разных форматах:
    // - объект {id, name} 
    // - просто ID (число)
    // - массив категорий [{id, name}]
    // - поле category_id отдельно
    let categoryId = null;
    let categoryName = null;
    
    // Приоритет 1: объект category с полями id и name
    if (product.category) {
      if (Array.isArray(product.category)) {
        // Если category - массив, берем первую категорию
        const firstCategory = product.category[0];
        if (firstCategory && typeof firstCategory === 'object') {
          categoryId = firstCategory.id || firstCategory.category_id || null;
          categoryName = firstCategory.name || firstCategory.title || null;
        }
      } else if (typeof product.category === 'object') {
        categoryId = product.category.id || product.category.category_id || null;
        categoryName = product.category.name || product.category.title || null;
      } else {
        // Если category - просто число (ID)
        categoryId = product.category;
      }
    }
    
    // Приоритет 2: отдельное поле category_id
    if (!categoryId && product.category_id) {
      categoryId = product.category_id;
    }
    
    // Приоритет 3: categories (множественное число) - массив категорий
    if (!categoryId && product.categories && Array.isArray(product.categories) && product.categories.length > 0) {
      const firstCategory = product.categories[0];
      if (firstCategory && typeof firstCategory === 'object') {
        categoryId = firstCategory.id || firstCategory.category_id || null;
        categoryName = firstCategory.name || firstCategory.title || null;
      }
    }

    // Если есть category_id но нет названия, пытаемся получить из других полей
    if (categoryId && !categoryName) {
      if (product.categoryName) {
        categoryName = product.categoryName;
      } else if (product.category_name) {
        categoryName = product.category_name;
      }
    }

    // Серия товара (series - это НЕ категория, а серия товара!)
    // Можно использовать как дополнительную информацию
    const series = product.series?.name || 
                   product.series || 
                   null;

    // Цена закупки
    // Согласно API v3, поле price содержит цену закупки
    const purchasePrice = product.price || 
                         product.purchase_price || 
                         product.base_price || 
                         product.cost_price || 
                         0;

    // Остаток на складе
    let availableQuantity = 0;
    
    // Сначала пытаемся найти в stockData по артикулу
    if (article && stockData && stockData.length > 0) {
      const stockItem = stockData.find(s => 
        (s.sid?.toString() === article) || 
        (s.article?.toString() === article) || 
        (s.id?.toString() === article)
      );
      if (stockItem) {
        availableQuantity = stockItem.balance || 
                           stockItem.quantity || 
                           stockItem.available_quantity || 
                           0;
      }
    }

    // Если не нашли в stockData, используем balance из товара
    if (availableQuantity === 0 && product.balance !== undefined && product.balance !== null) {
      availableQuantity = parseInt(product.balance) || 0;
    }

    // Изображение товара
    // Согласно API v3, изображения в полях img или photoUrl
    // img может быть объектом {url} или строкой
    let imageUrl = null;
    
    if (product.img) {
      if (typeof product.img === 'object') {
        imageUrl = product.img.url || product.img.src || product.img.link || null;
      } else {
        imageUrl = product.img;
      }
    } else if (product.photoUrl) {
      imageUrl = product.photoUrl;
    } else if (product.photo_url) {
      imageUrl = product.photo_url;
    } else if (product.image_url) {
      imageUrl = product.image_url;
    } else if (product.imageUrl) {
      imageUrl = product.imageUrl;
    } else if (product.image) {
      imageUrl = typeof product.image === 'object' ? product.image.url : product.image;
    } else if (product.photo) {
      imageUrl = typeof product.photo === 'object' ? product.photo.url : product.photo;
    }

    // Описание товара
    // stuff - материал товара, description - полное описание
    const description = product.stuff || 
                       product.description || 
                       product.full_description || 
                       product.about || 
                       null;

    // Дополнительные поля, которые могут быть полезны
    // Можно добавить в будущем при необходимости
    const parsedProduct = {
      id,
      article,
      name,
      brand,
      category_id: categoryId,
      category: categoryName || series, // Если нет категории, используем серию как fallback
      series, // Сохраняем серию отдельно если нужно
      purchase_price: parseFloat(purchasePrice) || 0,
      available_quantity: parseInt(availableQuantity) || 0,
      image_url: imageUrl,
      description
    };

    return parsedProduct;
  }

  /**
   * Получить категории из API sima-land v3
   * Согласно документации API v3: https://www.sima-land.ru/api/v3/help/#Категория-товаров
   * Категории возвращаются с полями: id, name, parent_id, depth (уровень вложенности)
   * Поддерживается пагинация для больших списков категорий
   */
  async fetchCategories(token, options = {}) {
    try {
      const perPage = options.perPage || 1000;
      const allCategories = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await axios.get(`${this.baseUrl}/category/`, {
          params: {
            'per-page': perPage,
            page: page
          },
          headers: {
            'x-api-key': token,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          timeout: 30000
        });

        const items = response.data.items || [];
        const meta = response.data._meta || {};

        // Обрабатываем категории согласно структуре API v3
        // Поля: id, name, parent_id, depth (уровень вложенности)
        for (const category of items) {
          allCategories.push({
            id: category.id,
            name: category.name || '',
            parent_id: category.parent_id || null,
            depth: category.depth || category.level || null
          });
        }

        // Проверяем, есть ли еще страницы
        const currentPage = meta.currentPage || page;
        const pageCount = meta.pageCount || 1;
        hasMore = currentPage < pageCount && items.length > 0;
        page++;

        // Защита от бесконечного цикла
        if (page > 100) {
          console.warn('Sima-land categories: слишком много страниц, прерываем загрузку');
          break;
        }

        // Небольшая задержка между запросами для соблюдения rate limits
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`📚 Загружено ${allCategories.length} категорий из API sima-land`);
      return allCategories;
    } catch (error) {
      console.error('Sima-land categories API error:', error.response?.data || error.message);
      // При ошибке возвращаем пустой массив, резервное заполнение будет из каталога
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
      // Фильтрация по категориям согласно документации API v3
      // Параметр может быть category_id или category_ids
      if (options?.categories && Array.isArray(options.categories) && options.categories.length > 0) {
        // API v3 может принимать несколько значений категорий
        // Попробуем разные варианты форматов
        const categoryIds = options.categories.map(id => parseInt(id)).filter(id => !isNaN(id));
        if (categoryIds.length > 0) {
          // Вариант 1: передаем как массив в query string (category_id[]=1&category_id[]=2)
          // Вариант 2: передаем через запятую (category_id=1,2)
          // Используем вариант с запятой, так как axios автоматически обработает массив
          if (categoryIds.length === 1) {
            params['category_id'] = categoryIds[0];
          } else {
            params['category_id'] = categoryIds.join(',');
          }
        }
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
               available_quantity = $7, image_url = $8, description = $9, updated_at = NOW()
           WHERE client_id = $1 AND article = $2
           RETURNING id`,
          [
            clientId,
            productData.article,
            productData.name,
            productData.brand,
            productData.category,
            productData.purchase_price,
            productData.available_quantity || 0,
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
            productData.available_quantity || 0,
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
            // Используем правильный парсер для извлечения всех полей товара
            const parsedProduct = this.parseProduct(product, stockData);
            
            if (!parsedProduct || !parsedProduct.article) {
              console.warn(`Skipping product with missing article:`, product.id || product.sid);
              continue;
            }

            // Подсчитываем товары с изображениями
            if (parsedProduct.image_url) {
              imagesCount++;
            }

            // Сохраняем товар в базу данных
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
                parsedProduct.article,
                parsedProduct.name,
                parsedProduct.brand,
                parsedProduct.category,
                parsedProduct.purchase_price,
                parsedProduct.available_quantity,
                parsedProduct.image_url,
                parsedProduct.description
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
            console.error(`Error saving product ${product.sid || product.id || 'unknown'}:`, err.message);
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
          // Используем правильный парсер для извлечения всех полей товара
          const parsedProduct = this.parseProduct(product);
          
          if (!parsedProduct || !parsedProduct.article) {
            console.warn(`Skipping product with missing article in catalog:`, product.id || product.sid);
            continue;
          }

          // Формируем строку для вставки в каталог
          const row = {
            id: parsedProduct.id,
            article: parsedProduct.article,
            name: parsedProduct.name,
            brand: parsedProduct.brand,
            category_id: parsedProduct.category_id,
            category: parsedProduct.category,
            purchase_price: parsedProduct.purchase_price,
            available_quantity: parsedProduct.available_quantity,
            image_url: parsedProduct.image_url,
            description: parsedProduct.description
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

        // Обновляем курсор последним id из распарсенных товаров
        if (items.length > 0) {
          const lastParsed = this.parseProduct(items[items.length - 1]);
          if (lastParsed && lastParsed.id) {
            cursorId = lastParsed.id;
          } else {
            // Fallback на исходные данные
            const last = items[items.length - 1];
            cursorId = last?.id || last?.sid || cursorId;
          }
        }

        console.log(`📦 Catalog batch #${batchIndex}: fetched=${items.length}, totalSaved=${savedCount + buffer.length}, cursor=${cursorId}`);
      }

      // финальный сброс буфера
      await flush();

      // Categories refresh (best effort)
      // Загружаем категории с пагинацией согласно документации API v3
      const cats = await this.fetchCategories(token, { perPage: 1000 });
      console.log(`📚 Categories fetched: ${cats.length}`);
      
      // Сохраняем категории в БД
      for (const c of cats) {
        try {
          await client.query(
            `INSERT INTO sima_land_categories (id, name, parent_id, level)
             VALUES ($1,$2,$3,$4)
             ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, parent_id=EXCLUDED.parent_id, level=EXCLUDED.level, updated_at=NOW()`,
            [c.id, c.name, c.parent_id || null, c.depth || null]
          );
        } catch (err) {
          // Тихая обработка ошибок для отдельных категорий
          console.warn(`Failed to save category ${c.id}:`, err.message);
        }
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

