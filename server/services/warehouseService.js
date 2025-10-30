const { pool } = require('../config/database');

class WarehouseService {
  async listItems(clientId, { search = '', limit = 50, offset = 0 } = {}) {
    const client = await pool.connect();
    try {
      let where = 'WHERE client_id = $1';
      const params = [clientId];
      if (search) {
        where += ' AND (name ILIKE $2 OR barcode ILIKE $2)';
        params.push(`%${search}%`);
      }
      const res = await client.query(
        `SELECT * FROM warehouse_items ${where} ORDER BY updated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      );
      return res.rows;
    } finally {
      client.release();
    }
  }

  async addItem(clientId, { name, barcode, purchase_price, stock = 0 }) {
    const client = await pool.connect();
    try {
      const res = await client.query(
        `INSERT INTO warehouse_items (client_id, name, barcode, purchase_price, stock)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (barcode) DO UPDATE SET
           name = EXCLUDED.name,
           purchase_price = EXCLUDED.purchase_price,
           updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [clientId, name, barcode || null, purchase_price, stock]
      );
      return res.rows[0];
    } finally {
      client.release();
    }
  }

  async setStockByOperator(clientId, itemId, stock, operatorUserId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const updated = await client.query(
        `UPDATE warehouse_items SET stock = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND client_id = $3 RETURNING *`,
        [stock, itemId, clientId]
      );
      if (updated.rows.length === 0) throw new Error('Item not found');
      await client.query(
        `INSERT INTO warehouse_transactions (client_id, item_id, type, quantity, note, created_by)
         VALUES ($1, $2, 'adjust', $3, 'Operator stock adjustment', $4)`,
        [clientId, itemId, stock, operatorUserId]
      );
      await client.query('COMMIT');
      return updated.rows[0];
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async findByBarcode(clientId, barcode) {
    const res = await pool.query(
      `SELECT * FROM warehouse_items WHERE client_id = $1 AND barcode = $2 LIMIT 1`,
      [clientId, barcode]
    );
    return res.rows[0] || null;
  }
}

module.exports = new WarehouseService();




