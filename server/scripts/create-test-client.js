/*
  Usage:
  node server/scripts/create-test-client.js

  Creates a test user and client with initial deposit of 100000 ₽.
*/
const bcrypt = require('bcrypt');
const { pool } = require('../config/database');

async function getLastBalance(clientId) {
  const res = await pool.query(
    `SELECT balance_after FROM deposits WHERE client_id = $1 AND status = 'completed' ORDER BY id DESC LIMIT 1`,
    [clientId]
  );
  return res.rows[0]?.balance_after ? parseFloat(res.rows[0].balance_after) : 0;
}

async function upsertTestUser() {
  const email = 'test+deposit@example.com';
  const phone = '+79990000000';
  const firstName = 'Test';
  const lastName = 'Deposit';
  const passwordHash = await bcrypt.hash('Test@12345', 12);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userRes = await client.query(
      `INSERT INTO users (email, password_hash, role, first_name, last_name, phone, email_verified, phone_verified)
       VALUES ($1, $2, 'client', $3, $4, $5, true, true)
       ON CONFLICT (email) DO UPDATE SET 
         first_name = EXCLUDED.first_name, 
         last_name = EXCLUDED.last_name,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [email, passwordHash, firstName, lastName, phone]
    );
    const userId = userRes.rows[0].id;

    // Создаем клиента, если еще не создан
    let clientId;
    const existingClient = await client.query('SELECT id FROM clients WHERE user_id = $1', [userId]);
    if (existingClient.rows.length > 0) {
      clientId = existingClient.rows[0].id;
      await client.query('UPDATE clients SET company_name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['Test Client', clientId]);
    } else {
      const clientRes = await client.query(
        `INSERT INTO clients (user_id, company_name, inn, api_keys)
         VALUES ($1, $2, $3, '{}')
         RETURNING id`,
        [userId, 'Test Client', '0000000000']
      );
      clientId = clientRes.rows[0].id;
    }

    await client.query('COMMIT');
    return { userId, clientId };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function seedDeposit(clientId, amount = 100000) {
  const balanceBefore = await getLastBalance(clientId);
  const balanceAfter = balanceBefore + amount;
  await pool.query(
    `INSERT INTO deposits (client_id, amount, balance_before, balance_after, transaction_type, description, payment_method, status)
     VALUES ($1, $2, $3, $4, 'deposit', 'Initial test deposit', 'manual', 'completed')`,
    [clientId, amount, balanceBefore, balanceAfter]
  );
}

async function main() {
  try {
    const { clientId } = await upsertTestUser();
    await seedDeposit(clientId, 100000);
    console.log('✅ Test client ready with 100000 ₽ deposit.');
  } catch (e) {
    console.error('Seed failed:', e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();


