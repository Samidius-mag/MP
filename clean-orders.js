const { Pool } = require('pg');
require('dotenv').config();

async function cleanOrders() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'dropshipping_db',
    user: process.env.DB_USER || 'dropshipping',
    password: process.env.DB_PASSWORD || 'KeyOfWorld2025',
  });

  const client = await pool.connect();
  try {
    console.log('🧹 Начинаем очистку заказов...');
    
    // 1. Удаляем дубликаты заказов (оставляем самый новый)
    console.log('1. Удаляем дубликаты заказов...');
    const duplicateResult = await client.query(`
      WITH duplicates AS (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY client_id, marketplace_order_id, marketplace
                 ORDER BY created_at DESC
               ) AS rn
        FROM orders
      )
      DELETE FROM orders
      WHERE id IN (SELECT id FROM duplicates WHERE rn > 1)
    `);
    console.log(`   Удалено ${duplicateResult.rowCount} дубликатов`);

    // 2. Обновляем статусы заказов на основе даты создания
    console.log('2. Обновляем статусы заказов...');
    
    // Заказы старше 7 дней считаем доставленными
    const oldOrdersResult = await client.query(`
      UPDATE orders 
      SET status = 'delivered' 
      WHERE created_at < NOW() - INTERVAL '7 days' 
      AND status = 'new'
    `);
    console.log(`   Обновлено ${oldOrdersResult.rowCount} старых заказов на статус 'delivered'`);

    // Заказы старше 3 дней считаем отправленными
    const shippedOrdersResult = await client.query(`
      UPDATE orders 
      SET status = 'shipped' 
      WHERE created_at < NOW() - INTERVAL '3 days' 
      AND created_at >= NOW() - INTERVAL '7 days'
      AND status = 'new'
    `);
    console.log(`   Обновлено ${shippedOrdersResult.rowCount} заказов на статус 'shipped'`);

    // 3. Обновляем order_type для существующих заказов
    console.log('3. Обновляем типы заказов...');
    const orderTypeResult = await client.query(`
      UPDATE orders 
      SET order_type = 'FBS' 
      WHERE order_type IS NULL OR order_type = ''
    `);
    console.log(`   Обновлено ${orderTypeResult.rowCount} заказов с типом 'FBS'`);

    // 4. Показываем статистику
    console.log('4. Текущая статистика заказов:');
    const statsResult = await client.query(`
      SELECT 
        status,
        order_type,
        COUNT(*) as count,
        MIN(created_at) as oldest,
        MAX(created_at) as newest
      FROM orders 
      GROUP BY status, order_type
      ORDER BY status, order_type
    `);

    console.log('   Статистика по статусам и типам:');
    statsResult.rows.forEach(row => {
      console.log(`   - ${row.status} (${row.order_type}): ${row.count} заказов`);
      console.log(`     Период: ${new Date(row.oldest).toLocaleDateString('ru-RU')} - ${new Date(row.newest).toLocaleDateString('ru-RU')}`);
    });

    console.log('✅ Очистка заказов завершена!');

  } catch (err) {
    console.error('❌ Ошибка при очистке заказов:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanOrders();












