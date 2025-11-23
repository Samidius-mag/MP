# Инструкция по установке TravelersGuild

## Быстрая установка

### 1. Сборка плагина

```bash
cd server/mcraft/plugins/TravelersGuild
mvn clean package
```

### 2. Установка

```bash
# Windows
copy target\TravelersGuild-1.0.0.jar ..\..\plugins\

# Linux/Mac
cp target/TravelersGuild-1.0.0.jar ../../plugins/
```

### 3. Запуск сервера

Запустите сервер. Плагин автоматически создаст необходимые файлы.

### 4. Создание NPC

После запуска сервера:

1. Подключитесь к серверу
2. Перейдите в место, где должен быть NPC
3. Выполните: `/guildadmin spawn`

## Проверка работы

1. Убейте 10 монстров
2. Используйте `/guild` или нажмите ПКМ на NPC
3. Зарегистрируйтесь в гильдии
4. Ваш ранг будет автоматически определен!

## Требования

- Paper/Spigot 1.21.1+
- Java 21+
- Maven (для сборки)

