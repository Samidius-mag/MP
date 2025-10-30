const { Pool } = require('pg');
require('dotenv').config();

async function runMigration() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'dropshipping_db',
    user: process.env.DB_USER || 'dropshipping',
    password: process.env.DB_PASSWORD || 'KeyOfWorld2025',
  });

  const client = await pool.connect();
  try {
    console.log('🚀 Запуск миграции для добавления поля order_type...');
    
    // Читаем файл миграции
    const fs = require('fs');
    const path = require('path');
    const migrationPath = path.join(__dirname, 'server', 'migrations', '20250115_add_order_type_simple.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Выполняем SQL миграцию...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    
    console.log('✅ Миграция выполнена успешно!');
    
    // Проверяем результат
    const result = await client.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'order_type'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Колонка order_type успешно добавлена!');
      console.log('📊 Детали:', result.rows[0]);
    } else {
      console.log('❌ Колонка order_type не найдена!');
    }
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Ошибка миграции:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();












