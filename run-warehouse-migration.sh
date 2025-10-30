#!/bin/bash

echo "🚀 Running warehouse module migration..."

cd server

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Run the migration
echo "📊 Applying warehouse migration..."
node -e "
const { pool } = require('./config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    try {
        const migrationSQL = fs.readFileSync(path.join(__dirname, 'migrations', '20250123_warehouse_module.sql'), 'utf8');
        await pool.query(migrationSQL);
        console.log('✅ Warehouse migration completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

runMigration();
"

echo "✅ Warehouse module setup complete!"

