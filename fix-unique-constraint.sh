#!/bin/bash

echo "Fixing unique constraint for wb_products_cache..."

node -e "
const { Pool } = require('pg');

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

async function fixConstraint() {
  const client = await pool.connect();
  try {
    console.log('Creating unique constraint for (nm_id, client_id)...');
    
    // Создаем уникальный индекс по (nm_id, client_id)
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_wb_products_cache_nm_id_client_id ON wb_products_cache(nm_id, client_id);');
    console.log('✓ Created unique index');
    
    // Проверяем существующие записи на дубликаты
    const duplicatesResult = await client.query(
      'SELECT nm_id, client_id, COUNT(*) as count FROM wb_products_cache GROUP BY nm_id, client_id HAVING COUNT(*) > 1'
    );
    
    if (duplicatesResult.rows.length > 0) {
      console.log('Found duplicates:', duplicatesResult.rows);
      
      // Удаляем дубликаты, оставляя только самую новую запись
      await client.query(
        'DELETE FROM wb_products_cache WHERE id NOT IN (SELECT DISTINCT ON (nm_id, client_id) id FROM wb_products_cache ORDER BY nm_id, client_id, last_updated DESC)'
      );
      console.log('✓ Removed duplicates');
    } else {
      console.log('✓ No duplicates found');
    }
    
    console.log('Constraint fix completed successfully!');
  } catch (error) {
    console.error('Constraint fix failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

fixConstraint();
"

echo "Constraint fix completed!"
