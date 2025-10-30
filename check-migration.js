const { Pool } = require('pg');
require('dotenv').config();

async function checkMigration() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'dropshipping_db',
    user: process.env.DB_USER || 'dropshipping',
    password: process.env.DB_PASSWORD || 'KeyOfWorld2025',
  });

  const client = await pool.connect();
  try {
    console.log('🔍 Проверка миграции...');
    
    // Проверяем, существует ли колонка order_type
    const result = await client.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'order_type'
    `);

    if (result.rows.length > 0) {
      console.log('✅ Колонка order_type успешно добавлена!');
      console.log('📊 Детали колонки:', result.rows[0]);
      
      // Проверяем количество записей с разными типами заказов
      const countResult = await client.query(`
        SELECT order_type, COUNT(*) as count 
        FROM orders 
        GROUP BY order_type
      `);
      
      console.log('📈 Статистика по типам заказов:');
      countResult.rows.forEach(row => {
        console.log(`   ${row.order_type}: ${row.count} заказов`);
      });
      
    } else {
      console.log('❌ Колонка order_type не найдена!');
      console.log('💡 Выполните миграцию: node scripts/run-migrations.js');
    }

  } catch (err) {
    console.error('❌ Ошибка при проверке миграции:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkMigration();

