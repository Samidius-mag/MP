const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

async function createAdmin() {
  const client = await pool.connect();
  
  try {
    // Проверяем, есть ли уже администратор
    const existingAdmin = await client.query(
      "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
    );

    if (existingAdmin.rows.length > 0) {
      console.log('✅ Администратор уже существует');
      return;
    }

    // Данные администратора
    const adminData = {
      email: process.env.ADMIN_EMAIL || 'admin@dropshipping.com',
      password: process.env.ADMIN_PASSWORD || 'Admin123!',
      firstName: process.env.ADMIN_FIRST_NAME || 'Администратор',
      lastName: process.env.ADMIN_LAST_NAME || 'Системы',
      phone: process.env.ADMIN_PHONE || '+7 (999) 123-45-67'
    };

    console.log('🔐 Создание пользователя-администратора...');
    console.log(`📧 Email: ${adminData.email}`);
    console.log(`👤 Имя: ${adminData.firstName} ${adminData.lastName}`);
    console.log(`📱 Телефон: ${adminData.phone}`);

    // Хешируем пароль
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(adminData.password, saltRounds);

    // Создаем пользователя-администратора
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_active, email_verified, phone_verified)
       VALUES ($1, $2, $3, $4, $5, 'admin', true, true, true)
       RETURNING id, email, first_name, last_name, role, created_at`,
      [adminData.email, passwordHash, adminData.firstName, adminData.lastName, adminData.phone]
    );

    const admin = userResult.rows[0];

    console.log('✅ Администратор успешно создан!');
    console.log(`🆔 ID: ${admin.id}`);
    console.log(`📧 Email: ${admin.email}`);
    console.log(`🔑 Пароль: ${adminData.password}`);
    console.log(`📅 Создан: ${admin.created_at}`);
    console.log('');
    console.log('⚠️  ВАЖНО: Сохраните эти данные в безопасном месте!');
    console.log('⚠️  Рекомендуется сменить пароль после первого входа!');

  } catch (err) {
    console.error('❌ Ошибка создания администратора:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Запускаем создание администратора
if (require.main === module) {
  createAdmin()
    .then(() => {
      console.log('🎉 Скрипт завершен успешно');
      process.exit(0);
    })
    .catch((err) => {
      console.error('💥 Критическая ошибка:', err);
      process.exit(1);
    });
}

module.exports = { createAdmin };





