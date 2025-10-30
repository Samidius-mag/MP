#!/bin/bash

echo "Running pricing module migration..."

cd "$(dirname "$0")"

echo ""
echo "========================================"
echo "Running pricing module migration"
echo "========================================"
echo ""

node server/scripts/run-migrations.js server/migrations/20250121_create_pricing_module.sql

echo ""
echo "========================================"
echo "Migration completed"
echo "========================================"
echo ""

read -p "Press any key to continue..."




