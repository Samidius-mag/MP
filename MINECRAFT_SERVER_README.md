# Minecraft Server Integration

Серверная часть для игры Minecraft использует **официальный сервер Minecraft Java Edition** версии 1.21.10, запускаемый через Java.

## Требования

1. **Java 21** - требуется для Minecraft 1.21.10
   - Скачать: https://adoptium.net/ или https://www.oracle.com/java/technologies/downloads/#java21
   - Проверить установку: `java -version` (должна быть версия 21 или выше)

2. **Файл сервера** - `server.jar` в папке `server/mcraft/`
   - Скачать официальный сервер: https://www.minecraft.net/en-us/download/server
   - Или использовать файл `minecraft_server.1.21.10.jar` (будет автоматически найден)

## Настройка

### 1. Установка Java

**Windows:**
```bash
# Скачайте и установите Java 21
# Убедитесь, что Java добавлена в PATH
java -version
```

**Linux:**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install openjdk-21-jdk

# Проверка
java -version
```

### 2. Подготовка файла сервера

1. Скачайте официальный сервер Minecraft с https://www.minecraft.net/en-us/download/server
2. Переименуйте файл в `server.jar` или оставьте как `minecraft_server.1.21.10.jar`
3. Поместите файл в папку `server/mcraft/`

Структура должна быть такой:
```
server/
  mcraft/
    server.jar  (или minecraft_server.1.21.10.jar)
```

### 3. Настройка переменных окружения

Добавьте следующие переменные в файл `server/env.example`:

```env
# Minecraft Server (Official Java Edition Server)
MINECRAFT_PORT=27015
MINECRAFT_VERSION=1.21.10
MINECRAFT_MOTD=Minecraft Server
MINECRAFT_MAX_PLAYERS=20
MINECRAFT_ONLINE_MODE=false
MINECRAFT_MIN_MEMORY=1024M
MINECRAFT_MAX_MEMORY=1024M
# Путь к Java (опционально, если Java не в PATH)
# JAVA_HOME=C:\Program Files\Java\jdk-21
```

**Параметры:**
- `MINECRAFT_PORT` - порт сервера (по умолчанию 27015)
- `MINECRAFT_VERSION` - версия сервера (для информации)
- `MINECRAFT_MOTD` - сообщение дня
- `MINECRAFT_MAX_PLAYERS` - максимальное количество игроков
- `MINECRAFT_ONLINE_MODE` - проверка лицензии (true/false)
- `MINECRAFT_MIN_MEMORY` - минимальная память для Java (например, 1024M)
- `MINECRAFT_MAX_MEMORY` - максимальная память для Java (например, 2048M)
- `JAVA_HOME` - путь к Java (если Java не в PATH)

## Запуск сервера

### Первый запуск

При первом запуске сервер создаст файл `eula.txt`. Вам нужно будет:

1. Остановить сервер
2. Открыть файл `server/mcraft/eula.txt`
3. Изменить `eula=false` на `eula=true`
4. Запустить сервер снова

### Через PM2 (рекомендуется)

Minecraft сервер настроен в `ecosystem.config.js`:

```bash
# Запуск всех сервисов через PM2
pm2 start ecosystem.config.js

# Или только Minecraft сервер
pm2 start server/minecraft.js --name minecraft-server

# Просмотр статуса
pm2 status

# Просмотр логов
pm2 logs minecraft-server

# Остановка
pm2 stop minecraft-server

# Перезапуск
pm2 restart minecraft-server
```

### Прямой запуск (для разработки)

```bash
cd server
node minecraft.js
```

Сервер будет доступен на порту **27015** (или указанном в `MINECRAFT_PORT`).

## Подключение к серверу

Игроки могут подключиться к серверу используя:
- **Адрес**: `localhost:27015` (для локального подключения)
- **Внешний IP**: `ваш_IP:27015` (для подключения из интернета)
- **Версия**: 1.21.10 (или совместимая версия клиента)

**⚠️ ВАЖНО:** 
- Для Minecraft 1.21.10 требуется **Java 21**
- Клиент должен быть версии 1.21.10 или совместимой
- Если `MINECRAFT_ONLINE_MODE=false`, можно подключаться с нелицензионными версиями

## Управление через PM2

Все операции управления выполняются через PM2:

```bash
# Запуск
pm2 start minecraft-server

# Остановка
pm2 stop minecraft-server

# Перезапуск
pm2 restart minecraft-server

# Просмотр логов
pm2 logs minecraft-server

# Просмотр статистики
pm2 show minecraft-server

# Мониторинг
pm2 monit
```

## Команды сервера

Вы можете отправлять команды в консоль сервера через PM2:

```bash
# Отправить команду в консоль сервера
pm2 send minecraft-server "say Привет всем!"
pm2 send minecraft-server "stop"
```

Или использовать стандартные команды Minecraft в игре:
- `/help` - Показать список доступных команд
- `/list` - Показать список игроков онлайн
- `/time` - Показать текущее время
- `/spawn` - Телепортироваться на точку спавна
- И другие стандартные команды Minecraft

## Функциональность

- ✅ Официальный сервер Minecraft Java Edition 1.21.10
- ✅ Полная поддержка всех функций игры
- ✅ Автоматический перезапуск через PM2
- ✅ Логирование в файлы PM2
- ✅ Управление памятью Java
- ✅ Мониторинг статуса сервера

## Структура файлов

```
server/
  mcraft/
    server.jar                    # Файл сервера Minecraft
    server-icon.png               # Иконка сервера (64x64 PNG, опционально)
    eula.txt                      # Лицензионное соглашение (создается автоматически)
    server.properties             # Настройки сервера (создается автоматически)
    world/                        # Мир сервера (создается автоматически)
    logs/                         # Логи сервера
  minecraft.js                    # Точка входа для запуска через PM2
  minecraft-server.js             # Основной файл для управления сервером
  services/
    minecraftService.js           # Сервис для управления игроками в памяти
ecosystem.config.js               # Конфигурация PM2
```

## Настройка сервера

После первого запуска в папке `server/mcraft/` будет создан файл `server.properties`. Вы можете редактировать его для настройки:

- `server-port` - порт сервера
- `max-players` - максимальное количество игроков
- `online-mode` - проверка лицензии
- `difficulty` - сложность (peaceful, easy, normal, hard)
- `gamemode` - режим игры (survival, creative, adventure, spectator)
- И другие настройки

**⚠️ ВАЖНО:** После изменения `server.properties` нужно перезапустить сервер.

## Настройка красивого названия и иконки сервера

### Красивое название сервера

Вы можете настроить красивое название сервера с цветами и форматированием, используя цветовые коды Minecraft.

**Цветовые коды:**
- `§0` = черный
- `§1` = темно-синий
- `§2` = темно-зеленый
- `§3` = темно-голубой
- `§4` = темно-красный
- `§5` = темно-фиолетовый
- `§6` = золотой/оранжевый
- `§7` = серый
- `§8` = темно-серый
- `§9` = синий
- `§a` = зеленый
- `§b` = голубой
- `§c` = красный
- `§d` = розовый
- `§e` = желтый
- `§f` = белый

**Коды форматирования:**
- `§l` = жирный
- `§o` = курсив
- `§n` = подчеркнутый
- `§m` = зачеркнутый
- `§k` = обфусцированный (случайные символы)
- `§r` = сброс форматирования

**Примеры настройки в `server/env.example`:**

```env
# Простое название (будет автоматически оформлено в оранжевый жирный)
MINECRAFT_SERVER_NAME=VIMEMC

# Красивое название с цветами и тегами
MINECRAFT_SERVER_NAME=§6§lVIMEMC§r §a[ОБНОВЛЕНИЕ] §d(o_o^o_o)

# Описание сервера (вторая строка)
MINECRAFT_SERVER_DESCRIPTION=§aВыживание §cАнархия §6Гриферский

# Или используйте MOTD для полного контроля
MINECRAFT_MOTD=§6§lVIMEMC§r §a[ОБНОВЛЕНИЕ]\n§aВыживание §cАнархия §6Гриферский
```

**Как это работает:**
1. Сервер автоматически создает `server.properties` с вашим MOTD
2. Название отображается в списке серверов в игре
3. При изменении настроек перезапустите сервер

### Иконка сервера

Чтобы добавить иконку сервера:

1. **Создайте изображение 64x64 пикселей** в формате PNG
2. **Сохраните как `server-icon.png`** в папку `server/mcraft/`
3. **Перезапустите сервер**

**Пример структуры:**
```
server/
  mcraft/
    server.jar
    server-icon.png  ← Ваша иконка (64x64 PNG)
    server.properties
    world/
```

**Требования к иконке:**
- Размер: **64x64 пикселей** (обязательно!)
- Формат: **PNG** (с прозрачностью или без)
- Имя файла: **server-icon.png** (точно!)

**Советы:**
- Используйте яркие цвета для лучшей видимости
- Избегайте слишком мелких деталей (иконка маленькая)
- Можно использовать онлайн-редакторы для создания иконок Minecraft
- Сервер автоматически обнаружит иконку при запуске

## Устранение неполадок

### Сервер не запускается

1. **Проверьте Java:**
   ```bash
   java -version
   # Должна быть версия 21 или выше
   ```

2. **Проверьте файл сервера:**
   ```bash
   # Убедитесь, что файл существует
   ls server/mcraft/server.jar
   # Или
   ls server/mcraft/minecraft_server.1.21.10.jar
   ```

3. **Проверьте порт:**
   ```bash
   # Windows
   netstat -ano | findstr :27015
   
   # Linux
   lsof -i :27015
   # Или
   netstat -tulpn | grep 27015
   ```

4. **Проверьте логи:**
   ```bash
   pm2 logs minecraft-server
   ```

5. **Проверьте EULA:**
   - Убедитесь, что в `server/mcraft/eula.txt` установлено `eula=true`

### Java не найдена

Если вы видите ошибку `ENOENT` или "Java is not installed":

1. **Установите Java 21:**
   - Windows: https://adoptium.net/
   - Linux: `sudo apt install openjdk-21-jdk`

2. **Установите JAVA_HOME:**
   ```bash
   # Windows (PowerShell)
   $env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
   
   # Linux
   export JAVA_HOME=/usr/lib/jvm/java-21-openjdk
   ```

3. **Или укажите в env.example:**
   ```env
   JAVA_HOME=C:\Program Files\Java\jdk-21
   ```

### Игроки не могут подключиться

1. **Проверьте файрвол:**
   - Убедитесь, что порт 27015 открыт для входящих соединений (TCP)

2. **Проверьте версию клиента:**
   - Клиент должен быть версии 1.21.10 или совместимой

3. **Проверьте online-mode:**
   - Если `MINECRAFT_ONLINE_MODE=false`, можно подключаться с нелицензионными версиями
   - Если `MINECRAFT_ONLINE_MODE=true`, требуется лицензия

4. **Проверьте статус сервера:**
   ```bash
   pm2 status
   pm2 logs minecraft-server
   ```

### Недостаточно памяти

Если сервер падает из-за нехватки памяти:

1. **Увеличьте память в env.example:**
   ```env
   MINECRAFT_MIN_MEMORY=2048M
   MINECRAFT_MAX_MEMORY=4096M
   ```

2. **Перезапустите сервер:**
   ```bash
   pm2 restart minecraft-server
   ```

### Проблемы с PM2

- Убедитесь, что PM2 установлен: `npm install -g pm2`
- Проверьте конфигурацию в `ecosystem.config.js`
- Для перезапуска используйте: `pm2 restart minecraft-server`

## Дополнительная информация

- Официальная документация: https://minecraft.wiki/w/Tutorial:Setting_up_a_Java_Edition_server
- Скачать сервер: https://www.minecraft.net/en-us/download/server
- Требования к системе: https://minecraft.wiki/w/Server/Requirements
