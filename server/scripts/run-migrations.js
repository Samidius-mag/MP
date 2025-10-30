const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

async function run() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'dropshipping_db',
    user: process.env.DB_USER || 'dropshipping',
    password: process.env.DB_PASSWORD || 'KeyOfWorld2025',
  });

  const client = await pool.connect();
  try {
    const migrationsDir = path.resolve(__dirname, '..', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`Running migration: ${file}`);
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      console.log(`✔ Done: ${file}`);
    }

    console.log('All migrations executed successfully');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();


