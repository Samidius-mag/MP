const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { requireClient, requireOperator, requireAdmin } = require('../middleware/auth');
const WarehouseService = require('../services/warehouseService');

const router = express.Router();

// Список товаров склада
router.get('/', requireClient, [
  query('search').optional().trim(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const items = await WarehouseService.listItems(req.user.id, req.query);
  res.json({ items });
});

// Добавление товара вручную (+)
router.post('/', requireClient, [
  body('name').isString().notEmpty(),
  body('barcode').optional().isString().isLength({ min: 3 }),
  body('purchase_price').isFloat({ min: 0 }),
  body('stock').optional().isInt({ min: 0 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const item = await WarehouseService.addItem(req.user.id, req.body);
  res.json({ item });
});

// Обновление остатка — только оператор/админ
router.put('/:id/stock', (req, res, next) => {
  if (req.user.role === 'operator' || req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Insufficient permissions' });
  }
}, [
  body('stock').isInt({ min: 0 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const updated = await WarehouseService.setStockByOperator(req.user.clientId || req.body.client_id, req.params.id, req.body.stock, req.user.id);
  res.json({ item: updated });
});

module.exports = router;



