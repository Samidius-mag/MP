#!/bin/bash

set -euo pipefail

# Конфигурация
APP_USER="root"
APP_HOME="/root/MP"
REPO_URL="https://github.com/Samidius-mag/MP.git"  # замените на ваш при необходимости
BRANCH="main"

echo "========================================"
echo "  Автодеплой клиента и сервера"
echo "========================================"

if [ "$(id -u)" -ne 0 ]; then
  echo "Запустите скрипт от root: sudo bash deploy.sh"
  exit 1
fi

mkdir -p "$APP_HOME"
chown -R "$APP_USER":"$APP_USER" "$APP_HOME"

sudo -iu "$APP_USER" bash -lc "\
  set -e; \
  # Создаем .env при отсутствии (прод)\
  if [ ! -f '$APP_HOME/.env' ]; then \
    cat > '$APP_HOME/.env' << 'ENVEOF'; \
DB_HOST=localhost\
DB_PORT=5432\
DB_NAME=dropshipping_db\
DB_USER=dropshipping\
DB_PASSWORD=KeyOfWorld2025\
JWT_SECRET=KeyOfWorld2025\
JWT_EXPIRES_IN=7d\
CLIENT_URL=https://vgk-perv.ru\
PORT=3001\
ENVEOF\
  fi; \
  \
  if [ -d '$APP_HOME/.git' ]; then \
    cd '$APP_HOME' && git fetch origin && git reset --hard origin/$BRANCH && git clean -fd; \
  else \
    git clone --branch $BRANCH '$REPO_URL' '$APP_HOME'; \
  fi; \
  \
  cd '$APP_HOME/server' && npm ci --production; \
  cd '$APP_HOME/client' && npm ci && NEXT_PUBLIC_API_URL=https://vgk-perv.ru/api npm run build; \
  \
  cd '$APP_HOME' && pm2 start ecosystem.config.js --env production && pm2 save; \
"

echo "Готово. Текущий статус PM2:"
sudo -iu "$APP_USER" pm2 status


