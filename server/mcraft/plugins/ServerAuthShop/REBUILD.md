# Инструкция по пересборке плагина

## ⚠️ ВАЖНО: После изменений в коде нужно пересобрать плагин!

### Шаг 1: Пересборка плагина

```bash
cd server/mcraft/plugins/ServerAuthShop
mvn clean package
```

После успешной сборки файл будет в:
```
target/ServerAuthShop-1.0.0.jar
```

### Шаг 2: Остановка сервера

**Вариант A: Через консоль сервера**
```
stop
```

**Вариант B: Через PM2**
```bash
pm2 stop minecraft-server
```

### Шаг 3: Замена JAR файла

**Windows:**
```powershell
# Удалите старый файл
Remove-Item ..\..\plugins\ServerAuthShop-*.jar

# Скопируйте новый
Copy-Item target\ServerAuthShop-1.0.0.jar ..\..\plugins\
```

**Linux/Mac:**
```bash
# Удалите старый файл
rm ../../plugins/ServerAuthShop-*.jar

# Скопируйте новый
cp target/ServerAuthShop-1.0.0.jar ../../plugins/
```

### Шаг 4: Запуск сервера

**Вариант A: Через PM2**
```bash
pm2 start minecraft-server
```

**Вариант B: Прямой запуск**
```bash
cd ../../..
node server/minecraft.js
```

### Шаг 5: Перезагрузка плагина (без перезапуска сервера)

Если сервер уже запущен, можно перезагрузить плагин через консоль:

```
reload confirm
```

Или через команду плагина (если есть):
```
/plugman reload ServerAuthShop
```

### Проверка

1. Подключитесь к серверу
2. Выполните команду `/shop`
3. Проверьте:
   - ✅ Названия предметов на русском языке
   - ✅ Алмаз стоит 1000 монет
   - ✅ Железный слиток стоит 100 монет
   - ✅ Земля и дерево продаются стаками
   - ✅ Добавлены новые предметы

### Если изменения не применились

1. **Проверьте логи сервера:**
   ```bash
   tail -f server/mcraft/logs/latest.log
   ```

2. **Убедитесь, что старый JAR удален:**
   ```bash
   ls -la server/mcraft/plugins/ServerAuthShop-*.jar
   ```

3. **Проверьте версию плагина в логах:**
   Должно быть: `[ServerAuthShop] ServerAuthShop плагин включен!`

4. **Полный перезапуск:**
   - Остановите сервер
   - Удалите папку `plugins/ServerAuthShop/` (данные сохранятся в players.json)
   - Скопируйте новый JAR
   - Запустите сервер

### Быстрая команда для пересборки и установки (Linux/Mac)

```bash
cd server/mcraft/plugins/ServerAuthShop && \
mvn clean package && \
rm ../../plugins/ServerAuthShop-*.jar && \
cp target/ServerAuthShop-1.0.0.jar ../../plugins/ && \
echo "Плагин пересобран и установлен! Перезагрузите сервер."
```

