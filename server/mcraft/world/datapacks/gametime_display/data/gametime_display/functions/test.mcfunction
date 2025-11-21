# Тестовая функция для проверки работы datapack
# Выполните: /function gametime_display:test

# Проверяем, что scoreboard создан
scoreboard objectives add gametime_display dummy "⏰ Игровое время"

# Устанавливаем отображение
scoreboard objectives setdisplay sidebar gametime_display

# Устанавливаем константы
scoreboard players set #const_1000 gametime_display 1000
scoreboard players set #const_24 gametime_display 24
scoreboard players set #const_60 gametime_display 60

# Инициализируем переменные
scoreboard players set #time gametime_display 0
scoreboard players set #hours gametime_display 0
scoreboard players set #minutes gametime_display 0
scoreboard players set #minutes_temp gametime_display 0

# Запускаем обновление времени
function gametime_display:update_time

# Сообщаем игроку
tellraw @a {"text":"✅ Datapack инициализирован! Время должно отображаться в правом углу.","color":"green"}

