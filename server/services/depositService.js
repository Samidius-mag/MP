const { pool } = require('../config/database');

class DepositService {
  static async getLastBalance(clientId) {
    const client = await pool.connect();
    try {
      const res = await client.query(
        `SELECT balance_after FROM deposits 
         WHERE client_id = $1 AND status = 'completed'
         ORDER BY id DESC LIMIT 1`,
        [clientId]
      );
      return res.rows[0]?.balance_after ? parseFloat(res.rows[0].balance_after) : 0;
    } finally {
      client.release();
    }
  }

  static async addTransaction({ clientId, amount, type, description = '', paymentMethod = null, paymentId = null, status = 'completed' }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const balanceBefore = await this.getLastBalance(clientId);
      const delta = parseFloat(amount);
      const balanceAfter = Math.round((balanceBefore + delta) * 100) / 100;

      const insertQuery = `
        INSERT INTO deposits (client_id, amount, balance_before, balance_after, transaction_type, description, payment_method, payment_id, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;

      const res = await client.query(insertQuery, [
        clientId,
        delta,
        balanceBefore,
        balanceAfter,
        type,
        description,
        paymentMethod,
        paymentId,
        status
      ]);

      await client.query('COMMIT');
      return res.rows[0];
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  static async deposit(clientId, amount, description = 'manual deposit') {
    if (amount <= 0) throw new Error('Deposit amount must be positive');
    return this.addTransaction({ clientId, amount, type: 'deposit', description });
  }

  static async withdrawForOrder(clientId, orderId, amount) {
    const sum = parseFloat(amount || 0);
    if (sum <= 0) return null;
    return this.addTransaction({
      clientId,
      amount: -sum,
      type: 'order_payment',
      description: `Order ${orderId} payment`
    });
  }
}

module.exports = DepositService;




