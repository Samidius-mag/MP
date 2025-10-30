const { Pool } = require('pg');

async function testPricingMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Testing pricing module migration...');
    
    // Проверяем существование таблиц
    const tables = [
      'client_pricing_settings',
      'wb_products_cache', 
      'pricing_history',
      'pricing_automation_settings',
      'pricing_automation_logs'
    ];

    for (const table of tables) {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [table]);
      
      if (result.rows[0].exists) {
        console.log(`✅ Table ${table} exists`);
      } else {
        console.log(`❌ Table ${table} does not exist`);
      }
    }

    // Проверяем индексы
    const indexes = [
      'idx_client_pricing_settings_client_id',
      'idx_wb_products_cache_nm_id',
      'idx_pricing_history_client_id',
      'idx_pricing_automation_settings_client_id',
      'idx_pricing_automation_logs_client_id'
    ];

    for (const index of indexes) {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM pg_indexes 
          WHERE indexname = $1
        );
      `, [index]);
      
      if (result.rows[0].exists) {
        console.log(`✅ Index ${index} exists`);
      } else {
        console.log(`❌ Index ${index} does not exist`);
      }
    }

    // Проверяем функции
    const functions = [
      'update_updated_at_column',
      'calculate_volume_liters'
    ];

    for (const func of functions) {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM pg_proc 
          WHERE proname = $1
        );
      `, [func]);
      
      if (result.rows[0].exists) {
        console.log(`✅ Function ${func} exists`);
      } else {
        console.log(`❌ Function ${func} does not exist`);
      }
    }

    console.log('\n✅ Pricing module migration test completed!');
    
  } catch (error) {
    console.error('❌ Migration test failed:', error.message);
  } finally {
    await pool.end();
  }
}

testPricingMigration();




