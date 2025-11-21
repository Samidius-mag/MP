# Тестирование datapack отображения времени

## Проверка работы datapack

### 1. Проверьте, что datapack загружен
В игре выполните:
```
/datapack list
```
Должен быть виден `[file/gametime_display]`

### 2. Проверьте scoreboard
В игре выполните:
```
/scoreboard objectives list
```
Должен быть виден `gametime_display`

### 3. Проверьте отображение
В игре выполните:
```
/scoreboard objectives setdisplay sidebar gametime_display
```

### 4. Проверьте текущее время
В игре выполните:
```
/time query daytime
```
Это покажет текущее время дня в тиках (0-24000)

### 5. Ручной запуск функции обновления
В игре выполните:
```
/function gametime_display:update_time
```

### 6. Перезагрузка datapack
Если время не обновляется, перезагрузите datapack:
```
/reload
```

## Ожидаемый результат

В правом углу экрана должны отображаться:
- **⏰ Время дня** - число от 0 до 24000 (игровые тики)
- **⏰ Часы** - число от 0 до 23
- **⏰ Минуты** - число от 0 до 59

## Устранение проблем

### Время не обновляется
1. Проверьте, что функция вызывается каждый тик:
   ```
   /function gametime_display:tick
   ```
2. Проверьте логи сервера на наличие ошибок
3. Попробуйте перезагрузить datapack: `/reload`

### Scoreboard не отображается
1. Убедитесь, что scoreboard создан:
   ```
   /scoreboard objectives add gametime_display dummy "⏰ Игровое время"
   ```
2. Установите отображение:
   ```
   /scoreboard objectives setdisplay sidebar gametime_display
   ```

### Значения показывают 0
1. Проверьте, что функция `update_time` вызывается
2. Выполните вручную:
   ```
   /function gametime_display:update_time
   ```
3. Проверьте, что константы установлены:
   ```
   /scoreboard players get #const_1000 gametime_display
   /scoreboard players get #const_24 gametime_display
   /scoreboard players get #const_60 gametime_display
   ```

