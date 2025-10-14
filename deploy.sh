#!/bin/bash

set -euo pipefail

# Конфигурация
APP_USER="dropshipping"
APP_HOME="/var/www/dropshipping"
REPO_URL="https://github.com/your-username/your-repo.git"  # замените на ваш
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
  if [ -d '$APP_HOME/.git' ]; then \
    cd '$APP_HOME' && git fetch origin && git reset --hard origin/$BRANCH && git clean -fd; \
  else \
    git clone --branch $BRANCH '$REPO_URL' '$APP_HOME'; \
  fi; \

  cd '$APP_HOME/server' && npm ci --production; \
  cd '$APP_HOME/client' && npm ci && npm run build; \

  cd '$APP_HOME' && pm2 start ecosystem.config.js --env production && pm2 save; \
"

echo "Готово. Текущий статус PM2:"
sudo -iu "$APP_USER" pm2 status


