#!/bin/bash

echo "Running price list and inventory migration..."

cd server
node -e "
const { pool } = require('./config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const client = await pool.connect();
  try {
    const migrationSQL = fs.readFileSync(path.join(__dirname, 'migrations', '20250120_create_price_list_and_inventory.sql'), 'utf8');
    await client.query(migrationSQL);
    console.log('✅ Price list and inventory migration completed successfully');
  } catch (err) {
    console.error('❌ Migration error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

runMigration();
"


