#!/bin/bash
echo "========================================"
echo "  Запуск миграции admin_logs"
echo "========================================"

cd server
node scripts/run-migrations.js

echo ""
echo "Миграция завершена!"




