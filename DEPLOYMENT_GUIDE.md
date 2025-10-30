# Руководство по развертыванию проекта на VPS

## Обзор вариантов развертывания

### 1. Git + SSH + PM2 (Рекомендуемый)
**Преимущества:**
- Простота настройки и использования
- Автоматическое обновление из Git репозитория
- Управление процессами через PM2
- Резервное копирование перед обновлением

**Недостатки:**
- Требует настройки SSH ключей
- Нужен Git репозиторий

### 2. Docker + Docker Compose
**Преимущества:**
- Полная изоляция окружения
- Легкое масштабирование
- Простое управление зависимостями
- Консистентность между окружениями

**Недостатки:**
- Больше потребление ресурсов
- Сложнее отладка

### 3. rsync + SSH
**Преимущества:**
- Быстрая синхронизация файлов
- Не требует Git репозитория
- Простота

**Недостатки:**
- Нет версионного контроля
- Ручное управление зависимостями

## Пошаговая инструкция

### Шаг 1: Подготовка VPS сервера

1. **Подключитесь к серверу:**
   ```bash
   ssh root@your-server-ip
   ```

2. **Запустите скрипт настройки:**
   ```bash
   wget https://raw.githubusercontent.com/your-repo/setup-vps-server.sh
   chmod +x setup-vps-server.sh
   sudo bash setup-vps-server.sh
   ```

3. **Настройте переменные окружения:**
   ```bash
   nano /var/www/dropshipping/.env
   ```

4. **Настройте домен в Nginx:**
   ```bash
   nano /etc/nginx/sites-available/dropshipping
   # Замените your-domain.com на ваш домен
   ```

5. **Получите SSL сертификат:**
   ```bash
   /var/www/dropshipping/get-ssl.sh
   systemctl restart nginx
   ```

### Шаг 2: Настройка локального окружения

1. **Создайте Git репозиторий:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/your-username/your-repo.git
   git push -u origin main
   ```

2. **Настройте конфигурацию развертывания:**
   ```bash
   # Отредактируйте deploy-config.txt
   VPS_HOST=your-server-ip
   VPS_USER=root
   VPS_PORT=22
   PROJECT_PATH=/var/www/dropshipping
   GIT_REPO=https://github.com/your-username/your-repo.git
   BRANCH=main
   PM2_APP_NAME=dropshipping-app
   ```

3. **Настройте SSH ключи:**
   ```bash
   ssh-keygen -t rsa -b 4096 -C "your-email@example.com"
   ssh-copy-id -p 22 root@your-server-ip
   ```

### Шаг 3: Развертывание

#### Вариант A: Git + SSH + PM2

1. **Запустите скрипт развертывания:**
   ```cmd
   deploy-to-vps.bat
   ```
   или
   ```powershell
   .\deploy-to-vps.ps1
   ```

2. **Проверьте статус:**
   ```bash
   ssh root@your-server-ip "pm2 status"
   ```

#### Вариант B: Docker + Docker Compose

1. **Установите Docker на VPS:**
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh
   ```

2. **Запустите развертывание:**
   ```cmd
   deploy-docker.bat
   ```

3. **Проверьте статус:**
   ```bash
   ssh root@your-server-ip "docker-compose ps"
   ```

### Шаг 4: Мониторинг и управление

#### PM2 команды:
```bash
pm2 status                    # Статус приложений
pm2 logs dropshipping-app    # Логи приложения
pm2 restart dropshipping-app # Перезапуск
pm2 stop dropshipping-app    # Остановка
pm2 monit                    # Мониторинг в реальном времени
```

#### Docker команды:
```bash
docker-compose ps                    # Статус контейнеров
docker-compose logs -f               # Логи всех сервисов
docker-compose logs -f server        # Логи сервера
docker-compose restart server        # Перезапуск сервера
docker-compose down                  # Остановка всех сервисов
```

## Автоматизация обновлений

### 1. Создайте alias для быстрого развертывания:
```bash
# Добавьте в ~/.bashrc или ~/.zshrc
alias deploy="cd /path/to/project && ./deploy-to-vps.bat"
```

### 2. Настройте GitHub Actions (опционально):
Создайте файл `.github/workflows/deploy.yml`:

```yaml
name: Deploy to VPS
on:
  push:
    branches: [ main ]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - name: Deploy to server
      uses: appleboy/ssh-action@v0.1.5
      with:
        host: ${{ secrets.VPS_HOST }}
        username: ${{ secrets.VPS_USER }}
        key: ${{ secrets.SSH_KEY }}
        script: |
          cd /var/www/dropshipping
          git pull origin main
          pm2 restart dropshipping-app
```

## Безопасность

1. **Настройте файрвол:**
   ```bash
   ufw allow ssh
   ufw allow 'Nginx Full'
   ufw enable
   ```

2. **Настройте fail2ban:**
   ```bash
   systemctl enable fail2ban
   systemctl start fail2ban
   ```

3. **Регулярно обновляйте систему:**
   ```bash
   apt update && apt upgrade -y
   ```

4. **Настройте резервное копирование:**
   ```bash
   # Добавьте в crontab
   0 2 * * * /var/www/dropshipping/backup.sh
   ```

## Устранение неполадок

### Проблемы с подключением SSH:
- Проверьте SSH ключи: `ssh-add -l`
- Проверьте подключение: `ssh -v root@your-server-ip`

### Проблемы с PM2:
- Проверьте логи: `pm2 logs dropshipping-app`
- Перезапустите: `pm2 restart dropshipping-app`

### Проблемы с Nginx:
- Проверьте конфигурацию: `nginx -t`
- Перезапустите: `systemctl restart nginx`

### Проблемы с базой данных:
- Проверьте подключение: `psql -h localhost -U dropshipping -d dropshipping_db`
- Проверьте статус: `systemctl status postgresql`

## Рекомендации

1. **Используйте Git для версионного контроля**
2. **Настройте мониторинг (PM2 monit или внешние сервисы)**
3. **Регулярно создавайте резервные копии**
4. **Используйте HTTPS для безопасности**
5. **Настройте автоматические обновления безопасности**
6. **Мониторьте логи и производительность**



