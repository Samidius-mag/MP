#!/bin/bash

# Скрипт первоначальной настройки VPS сервера для проекта дропшиппинга
# Запускать с правами root: sudo bash setup-vps-server.sh

set -e

echo "========================================"
echo "   Настройка VPS сервера для проекта"
echo "========================================"

# Обновляем систему
echo "Обновляем индекс пакетов..."
apt update

# Устанавливаем необходимые пакеты
echo "Устанавливаем необходимые пакеты..."
apt install -y curl wget git nginx certbot python3-certbot-nginx ufw fail2ban

# Устанавливаем PostgreSQL
echo "Устанавливаем PostgreSQL..."
apt install -y postgresql postgresql-contrib

# Настроим PM2 позже под пользователем приложения (dropshipping)

# Создаем пользователя для приложения
echo "Создаем пользователя для приложения..."
useradd -m -s /bin/bash dropshipping || echo "Пользователь уже существует"
usermod -aG sudo dropshipping

# Создаем директории
echo "Создаем директории..."
mkdir -p /var/www/dropshipping
mkdir -p /var/log/pm2
chown -R dropshipping:dropshipping /var/www/dropshipping
chown -R dropshipping:dropshipping /var/log/pm2

# Настраиваем PostgreSQL
echo "Настраиваем PostgreSQL..."
sudo -u postgres psql -c "CREATE USER dropshipping WITH PASSWORD 'KeyOfWorld2025';" || true
sudo -u postgres psql -c "CREATE DATABASE dropshipping_db OWNER dropshipping;" || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE dropshipping_db TO dropshipping;" || true

# Настраиваем Nginx
echo "Настраиваем Nginx..."
cat > /etc/nginx/sites-available/dropshipping << 'EOF'
server {
    listen 80;
    server_name vgk-perv.ru www.vgk-perv.ru;

    # Редирект на HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name vgk-perv.ru www.vgk-perv.ru;

    # Путь к уже полученным сертификатам Let's Encrypt
    ssl_certificate /etc/letsencrypt/live/vgk-perv.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vgk-perv.ru/privkey.pem;

    # Настройки SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;

    # Статические файлы Next.js
    location /_next/static/ {
        alias /var/www/dropshipping/client/.next/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API запросы к серверу
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Все остальные запросы к Next.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Включаем сайт
ln -sf /etc/nginx/sites-available/dropshipping /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Проверяем конфигурацию Nginx
nginx -t

# Настраиваем файрвол
echo "Настраиваем файрвол..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 'Nginx Full'
ufw --force enable

# Настраиваем fail2ban
echo "Настраиваем fail2ban..."
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log
maxretry = 3
EOF

systemctl enable fail2ban
systemctl restart fail2ban

# Создаем файл переменных окружения
echo "Создаем файл переменных окружения..."
cat > /var/www/dropshipping/.env << 'EOF'
# База данных
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dropshipping_db
DB_USER=dropshipping
DB_PASSWORD=KeyOfWorld2025

# JWT
JWT_SECRET=KeyOfWorld2025

# API ключи (заполните своими)
WILDBERRIES_API_KEY=KeyOfWorld2025
OZON_API_KEY=KeyOfWorld2025

# Email (заполните своими)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=KeyOfWorld2025

# Другие настройки
NODE_ENV=production
PORT=3001
NEXT_PUBLIC_API_URL=https://vgk-perv.ru/api
EOF

chown dropshipping:dropshipping /var/www/dropshipping/.env
chmod 600 /var/www/dropshipping/.env

### SSL уже получен для vgk-perv.ru — шаг получения сертификата пропускаем

echo ""
echo "========================================"
echo "   НАСТРОЙКА СЕРВЕРА ЗАВЕРШЕНА!"
echo "========================================"
echo ""
echo "Следующие шаги:"
echo "1. Отредактируйте файл /var/www/dropshipping/.env с вашими настройками"
echo "2. Конфигурация Nginx уже указывает на vgk-perv.ru и действующие сертификаты"
echo "3. Перезапустите Nginx: systemctl restart nginx"
echo "4. Используйте скрипты развертывания для загрузки кода"
echo ""
echo "Для развертывания кода используйте:"
echo "  ./deploy-to-vps.bat (Windows)"
echo "  ./deploy-to-vps.ps1 (PowerShell)"
echo ""
