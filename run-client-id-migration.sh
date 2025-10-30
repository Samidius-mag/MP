#!/bin/bash

echo "Running client_id migration for wb_products_cache..."

cd server && node -e "
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'dropshipping_db',
  user: 'dropshipping',
  password: 'KeyOfWorld2025',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Adding client_id column to wb_products_cache...');
    
    // Добавляем поле client_id
    await client.query('ALTER TABLE wb_products_cache ADD COLUMN IF NOT EXISTS client_id INTEGER;');
    console.log('✓ Added client_id column');
    
    // Создаем индекс
    await client.query('CREATE INDEX IF NOT EXISTS idx_wb_products_cache_client_id ON wb_products_cache(client_id);');
    console.log('✓ Created index');
    
    // Обновляем существующие записи
    await client.query('UPDATE wb_products_cache SET client_id = 1 WHERE client_id IS NULL;');
    console.log('✓ Updated existing records');
    
    // Делаем поле обязательным
    await client.query('ALTER TABLE wb_products_cache ALTER COLUMN client_id SET NOT NULL;');
    console.log('✓ Made client_id NOT NULL');
    
    // Добавляем внешний ключ
    await client.query('ALTER TABLE wb_products_cache ADD CONSTRAINT fk_wb_products_cache_client_id FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;');
    console.log('✓ Added foreign key constraint');
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
"

echo "Migration completed!"
