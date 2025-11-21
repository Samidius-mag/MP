# Быстрый старт - Отображение времени

## Шаг 1: Перезагрузите datapack

В игре выполните команду (БЕЗ лишних символов):
```
/reload
```

## Шаг 2: Ручная инициализация (если не сработало автоматически)

В игре выполните:
```
/function gametime_display:simple_init
```

## Шаг 3: Проверка работы

В игре выполните:
```
/function gametime_display:update_time
```

## Шаг 4: Проверка текущего времени

В игре выполните:
```
/time query daytime
```

Должно показать число от 0 до 24000.

## Что должно отображаться

В правом углу экрана должно появиться:
- **Время дня** - число от 0 до 24000 (игровые тики)

## Если ничего не работает

1. Проверьте, что datapack загружен:
   ```
   /datapack list
   ```
   Должен быть виден `[file/gametime_display]`

2. Создайте scoreboard вручную:
   ```
   /scoreboard objectives add gametime_display dummy "Игровое время"
   /scoreboard objectives setdisplay sidebar gametime_display
   ```

3. Обновите время вручную:
   ```
   /execute store result score #time gametime_display run time query daytime
   /scoreboard players set "Время дня" gametime_display 0
   /scoreboard players operation "Время дня" gametime_display = #time gametime_display
   ```

## Важно!

- Команды нужно вводить БЕЗ лишних символов
- Используйте `/` в начале команды
- Не добавляйте `[ЗДЕСЬ]` или другие маркеры

