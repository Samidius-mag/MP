const express = require('express');
const { body, validationResult, query, header } = require('express-validator');
const { pool } = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');

const router = express.Router();

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '..', 'uploads', 'api');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `api-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv', 'application/json'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Недопустимый тип файла. Разрешены только Excel, CSV, JSON файлы.'));
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});

// Middleware для проверки API ключа
const validateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      return res.status(401).json({ error: 'API ключ не предоставлен' });
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT id, company_name FROM clients WHERE api_keys ? $1',
        [apiKey]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Неверный API ключ' });
      }

      req.clientId = result.rows[0].id;
      req.clientName = result.rows[0].company_name;
      next();
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('API key validation error:', error);
    res.status(500).json({ error: 'Ошибка проверки API ключа' });
  }
};

// ===== API ДЛЯ ПРАЙС-ЛИСТА =====

// Получение прайс-листа
router.get('/price-list', validateApiKey, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 1000 }),
  query('category').optional().trim(),
  query('brand').optional().trim(),
  query('search').optional().trim(),
  query('is_active').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const offset = (page - 1) * limit;
    const { category, brand, search, is_active } = req.query;

    const client = await pool.connect();
    try {
      let whereClause = 'WHERE 1=1';
      let queryParams = [];
      let paramIndex = 1;

      if (category) {
        whereClause += ` AND category = $${paramIndex}`;
        queryParams.push(category);
        paramIndex++;
      }

      if (brand) {
        whereClause += ` AND brand = $${paramIndex}`;
        queryParams.push(brand);
        paramIndex++;
      }

      if (search) {
        whereClause += ` AND (article ILIKE $${paramIndex} OR name ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      if (is_active !== undefined) {
        whereClause += ` AND is_active = $${paramIndex}`;
        queryParams.push(is_active === 'true');
        paramIndex++;
      }

      // Получаем товары с остатками
      const productsResult = await client.query(
        `SELECT pl.*, i.quantity, i.reserved_quantity, i.available_quantity, i.warehouse_location
         FROM price_list pl
         LEFT JOIN inventory i ON pl.article = i.article
         ${whereClause}
         ORDER BY pl.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...queryParams, limit, offset]
      );

      // Получаем общее количество
      const countResult = await client.query(
        `SELECT COUNT(*) as total
         FROM price_list pl
         LEFT JOIN inventory i ON pl.article = i.article
         ${whereClause}`,
        queryParams
      );

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      res.json({
        success: true,
        data: productsResult.rows,
        pagination: {
          currentPage: page,
          totalPages,
          total,
          limit
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('API Error fetching price list:', error);
    res.status(500).json({ error: 'Ошибка получения прайс-листа' });
  }
});

// Обновление прайс-листа через JSON
router.post('/price-list/update', validateApiKey, [
  body('products').isArray({ min: 1 }),
  body('products.*.article').notEmpty().trim(),
  body('products.*.name').notEmpty().trim(),
  body('products.*.purchase_price').isFloat({ min: 0 }),
  body('products.*.selling_price').isFloat({ min: 0 }),
  body('products.*.category').optional().trim(),
  body('products.*.brand').optional().trim(),
  body('products.*.description').optional().trim(),
  body('products.*.is_active').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { products } = req.body;

    const client = await pool.connect();
    try {
      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (const product of products) {
        try {
          const { article, name, purchase_price, selling_price, category, brand, description, is_active } = product;
          
          // Рассчитываем наценку
          const markupPercent = ((selling_price - purchase_price) / purchase_price * 100).toFixed(2);

          // Обновляем или создаем товар
          await client.query(
            `INSERT INTO price_list (article, name, purchase_price, selling_price, category, brand, description, markup_percent, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (article) DO UPDATE SET
               name = EXCLUDED.name,
               purchase_price = EXCLUDED.purchase_price,
               selling_price = EXCLUDED.selling_price,
               category = EXCLUDED.category,
               brand = EXCLUDED.brand,
               description = EXCLUDED.description,
               markup_percent = EXCLUDED.markup_percent,
               is_active = EXCLUDED.is_active,
               updated_at = CURRENT_TIMESTAMP`,
            [article, name, purchase_price, selling_price, category || null, brand || null, description || null, markupPercent, is_active !== false]
          );

          results.push({
            article,
            success: true,
            action: 'updated'
          });
          successCount++;

        } catch (error) {
          results.push({
            article: product.article,
            success: false,
            error: error.message
          });
          errorCount++;
        }
      }

      res.json({
        success: true,
        message: `Обработано ${successCount} товаров, ошибок: ${errorCount}`,
        results
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('API Error updating price list:', error);
    res.status(500).json({ error: 'Ошибка обновления прайс-листа' });
  }
});

// Обновление прайс-листа через Excel/CSV файл
router.post('/price-list/import', validateApiKey, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    const filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    
    let products = [];

    try {
      if (fileExtension === '.xlsx' || fileExtension === '.xls') {
        // Обработка Excel файла
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        products = xlsx.utils.sheet_to_json(worksheet);
      } else if (fileExtension === '.csv') {
        // Обработка CSV файла
        const csvContent = fs.readFileSync(filePath, 'utf8');
        const lines = csvContent.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        
        for (let i = 1; i < lines.length; i++) {
          if (lines[i].trim()) {
            const values = lines[i].split(',').map(v => v.trim());
            const product = {};
            headers.forEach((header, index) => {
              product[header] = values[index];
            });
            products.push(product);
          }
        }
      } else {
        return res.status(400).json({ error: 'Неподдерживаемый формат файла' });
      }

      // Валидация и обработка данных
      const client = await pool.connect();
      try {
        const results = [];
        let successCount = 0;
        let errorCount = 0;

        for (const product of products) {
          try {
            // Маппинг полей (поддерживаем разные названия колонок)
            const article = product.article || product.Артикул || product.Артикул_товара;
            const name = product.name || product.Название || product.Наименование;
            const purchase_price = parseFloat(product.purchase_price || product.Закупочная_цена || product.Цена_закупки || 0);
            const selling_price = parseFloat(product.selling_price || product.Цена_продажи || product.Розничная_цена || 0);
            const category = product.category || product.Категория || product.Категория_товара;
            const brand = product.brand || product.Бренд || product.Производитель;
            const description = product.description || product.Описание;
            const is_active = product.is_active !== undefined ? product.is_active : true;

            if (!article || !name || purchase_price <= 0 || selling_price <= 0) {
              throw new Error('Недостаточно данных для создания товара');
            }

            // Рассчитываем наценку
            const markupPercent = ((selling_price - purchase_price) / purchase_price * 100).toFixed(2);

            // Обновляем или создаем товар
            await client.query(
              `INSERT INTO price_list (article, name, purchase_price, selling_price, category, brand, description, markup_percent, is_active)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               ON CONFLICT (article) DO UPDATE SET
                 name = EXCLUDED.name,
                 purchase_price = EXCLUDED.purchase_price,
                 selling_price = EXCLUDED.selling_price,
                 category = EXCLUDED.category,
                 brand = EXCLUDED.brand,
                 description = EXCLUDED.description,
                 markup_percent = EXCLUDED.markup_percent,
                 is_active = EXCLUDED.is_active,
                 updated_at = CURRENT_TIMESTAMP`,
              [article, name, purchase_price, selling_price, category || null, brand || null, description || null, markupPercent, is_active]
            );

            results.push({
              article,
              success: true,
              action: 'updated'
            });
            successCount++;

          } catch (error) {
            results.push({
              article: product.article || product.Артикул || 'unknown',
              success: false,
              error: error.message
            });
            errorCount++;
          }
        }

        // Удаляем временный файл
        fs.unlinkSync(filePath);

        res.json({
          success: true,
          message: `Импорт завершен. Обработано ${successCount} товаров, ошибок: ${errorCount}`,
          results
        });
      } finally {
        client.release();
      }
    } catch (error) {
      // Удаляем временный файл в случае ошибки
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      throw error;
    }
  } catch (error) {
    console.error('API Error importing price list:', error);
    res.status(500).json({ error: 'Ошибка импорта прайс-листа' });
  }
});

// ===== API ДЛЯ ОСТАТКОВ =====

// Получение остатков
router.get('/inventory', validateApiKey, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 1000 }),
  query('article').optional().trim(),
  query('search').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const offset = (page - 1) * limit;
    const { article, search } = req.query;

    const client = await pool.connect();
    try {
      let whereClause = 'WHERE 1=1';
      let queryParams = [];
      let paramIndex = 1;

      if (article) {
        whereClause += ` AND i.article = $${paramIndex}`;
        queryParams.push(article);
        paramIndex++;
      }

      if (search) {
        whereClause += ` AND (i.article ILIKE $${paramIndex} OR pl.name ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      // Получаем остатки с информацией о товарах
      const inventoryResult = await client.query(
        `SELECT i.*, pl.name, pl.purchase_price, pl.selling_price, pl.category, pl.brand
         FROM inventory i
         JOIN price_list pl ON i.article = pl.article
         ${whereClause}
         ORDER BY i.updated_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...queryParams, limit, offset]
      );

      // Получаем общее количество
      const countResult = await client.query(
        `SELECT COUNT(*) as total
         FROM inventory i
         JOIN price_list pl ON i.article = pl.article
         ${whereClause}`,
        queryParams
      );

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      res.json({
        success: true,
        data: inventoryResult.rows,
        pagination: {
          currentPage: page,
          totalPages,
          total,
          limit
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('API Error fetching inventory:', error);
    res.status(500).json({ error: 'Ошибка получения остатков' });
  }
});

// Обновление остатков через JSON
router.post('/inventory/update', validateApiKey, [
  body('updates').isArray({ min: 1 }),
  body('updates.*.article').notEmpty().trim(),
  body('updates.*.quantity').isInt({ min: 0 }),
  body('updates.*.warehouse_location').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { updates } = req.body;

    const client = await pool.connect();
    try {
      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (const update of updates) {
        try {
          const { article, quantity, warehouse_location } = update;

          // Проверяем, существует ли товар в прайс-листе
          const product = await client.query(
            'SELECT id FROM price_list WHERE article = $1',
            [article]
          );

          if (product.rows.length === 0) {
            throw new Error('Товар не найден в прайс-листе');
          }

          // Получаем текущие остатки
          const currentInventory = await client.query(
            'SELECT quantity FROM inventory WHERE article = $1',
            [article]
          );

          const oldQuantity = currentInventory.rows.length > 0 ? currentInventory.rows[0].quantity : 0;

          // Обновляем остатки
          await client.query(
            `INSERT INTO inventory (article, quantity, warehouse_location, last_updated_by)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (article) DO UPDATE SET
               quantity = EXCLUDED.quantity,
               warehouse_location = EXCLUDED.warehouse_location,
               last_updated_by = EXCLUDED.last_updated_by,
               updated_at = CURRENT_TIMESTAMP`,
            [article, quantity, warehouse_location || null, req.clientId]
          );

          results.push({
            article,
            success: true,
            oldQuantity,
            newQuantity: quantity
          });
          successCount++;

        } catch (error) {
          results.push({
            article: update.article,
            success: false,
            error: error.message
          });
          errorCount++;
        }
      }

      res.json({
        success: true,
        message: `Обновлено ${successCount} позиций, ошибок: ${errorCount}`,
        results
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('API Error updating inventory:', error);
    res.status(500).json({ error: 'Ошибка обновления остатков' });
  }
});

// Обновление остатков через Excel/CSV файл
router.post('/inventory/import', validateApiKey, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    const filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    
    let updates = [];

    try {
      if (fileExtension === '.xlsx' || fileExtension === '.xls') {
        // Обработка Excel файла
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        updates = xlsx.utils.sheet_to_json(worksheet);
      } else if (fileExtension === '.csv') {
        // Обработка CSV файла
        const csvContent = fs.readFileSync(filePath, 'utf8');
        const lines = csvContent.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        
        for (let i = 1; i < lines.length; i++) {
          if (lines[i].trim()) {
            const values = lines[i].split(',').map(v => v.trim());
            const update = {};
            headers.forEach((header, index) => {
              update[header] = values[index];
            });
            updates.push(update);
          }
        }
      } else {
        return res.status(400).json({ error: 'Неподдерживаемый формат файла' });
      }

      // Валидация и обработка данных
      const client = await pool.connect();
      try {
        const results = [];
        let successCount = 0;
        let errorCount = 0;

        for (const update of updates) {
          try {
            // Маппинг полей
            const article = update.article || update.Артикул || update.Артикул_товара;
            const quantity = parseInt(update.quantity || update.Количество || update.Остаток || 0);
            const warehouse_location = update.warehouse_location || update.Склад || update.Местоположение;

            if (!article || isNaN(quantity) || quantity < 0) {
              throw new Error('Недостаточно данных для обновления остатков');
            }

            // Проверяем, существует ли товар
            const product = await client.query(
              'SELECT id FROM price_list WHERE article = $1',
              [article]
            );

            if (product.rows.length === 0) {
              throw new Error('Товар не найден в прайс-листе');
            }

            // Получаем текущие остатки
            const currentInventory = await client.query(
              'SELECT quantity FROM inventory WHERE article = $1',
              [article]
            );

            const oldQuantity = currentInventory.rows.length > 0 ? currentInventory.rows[0].quantity : 0;

            // Обновляем остатки
            await client.query(
              `INSERT INTO inventory (article, quantity, warehouse_location, last_updated_by)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (article) DO UPDATE SET
                 quantity = EXCLUDED.quantity,
                 warehouse_location = EXCLUDED.warehouse_location,
                 last_updated_by = EXCLUDED.last_updated_by,
                 updated_at = CURRENT_TIMESTAMP`,
              [article, quantity, warehouse_location || null, req.clientId]
            );

            results.push({
              article,
              success: true,
              oldQuantity,
              newQuantity: quantity
            });
            successCount++;

          } catch (error) {
            results.push({
              article: update.article || update.Артикул || 'unknown',
              success: false,
              error: error.message
            });
            errorCount++;
          }
        }

        // Удаляем временный файл
        fs.unlinkSync(filePath);

        res.json({
          success: true,
          message: `Импорт остатков завершен. Обновлено ${successCount} позиций, ошибок: ${errorCount}`,
          results
        });
      } finally {
        client.release();
      }
    } catch (error) {
      // Удаляем временный файл в случае ошибки
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      throw error;
    }
  } catch (error) {
    console.error('API Error importing inventory:', error);
    res.status(500).json({ error: 'Ошибка импорта остатков' });
  }
});

module.exports = router;


