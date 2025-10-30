#!/bin/bash

echo "Fixing client_id migration for wb_products_cache..."

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

async function fixMigration() {
  const client = await pool.connect();
  try {
    console.log('Checking existing clients...');
    
    // Проверяем существующих клиентов
    const clientsResult = await client.query('SELECT id, user_id FROM clients ORDER BY id;');
    console.log('Existing clients:', clientsResult.rows);
    
    if (clientsResult.rows.length === 0) {
      console.log('No clients found. Creating a default client...');
      // Создаем клиента по умолчанию
      const defaultClientResult = await client.query(
        'INSERT INTO clients (user_id, company_name, contact_person, phone, email, address, api_keys, created_at, updated_at) VALUES (1, \'Default Client\', \'Default Contact\', \'\', \'\', \'\', \'{}\', NOW(), NOW()) RETURNING id;'
      );
      console.log('Created default client with id:', defaultClientResult.rows[0].id);
    }
    
    // Получаем первый доступный client_id
    const firstClientResult = await client.query('SELECT id FROM clients ORDER BY id LIMIT 1;');
    const firstClientId = firstClientResult.rows[0].id;
    console.log('Using client_id:', firstClientId);
    
    // Удаляем существующий foreign key constraint
    try {
      await client.query('ALTER TABLE wb_products_cache DROP CONSTRAINT IF EXISTS fk_wb_products_cache_client_id;');
      console.log('✓ Dropped existing foreign key constraint');
    } catch (e) {
      console.log('No existing constraint to drop');
    }
    
    // Обновляем все записи с правильным client_id
    await client.query('UPDATE wb_products_cache SET client_id = \$1 WHERE client_id IS NULL OR client_id = 1;', [firstClientId]);
    console.log('✓ Updated records with correct client_id');
    
    // Добавляем foreign key constraint
    await client.query('ALTER TABLE wb_products_cache ADD CONSTRAINT fk_wb_products_cache_client_id FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;');
    console.log('✓ Added foreign key constraint');
    
    // Проверяем результат
    const checkResult = await client.query('SELECT client_id, COUNT(*) as count FROM wb_products_cache GROUP BY client_id;');
    console.log('Final result:', checkResult.rows);
    
    console.log('Migration fixed successfully!');
  } catch (error) {
    console.error('Migration fix failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

fixMigration();
"

echo "Migration fix completed!"


