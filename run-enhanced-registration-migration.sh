#!/bin/bash

echo "Запуск миграции для улучшенной системы регистрации..."

cd server

node -e "
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'dropshipping',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Выполнение миграции...');
    const migrationSQL = fs.readFileSync(path.join(__dirname, 'migrations', '20250115_enhanced_registration.sql'), 'utf8');
    await client.query(migrationSQL);
    console.log('Миграция выполнена успешно!');
  } catch (error) {
    console.error('Ошибка миграции:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
"

if [ $? -eq 0 ]; then
    echo "Миграция завершена успешно!"
else
    echo "Ошибка при выполнении миграции!"
    exit 1
fi
