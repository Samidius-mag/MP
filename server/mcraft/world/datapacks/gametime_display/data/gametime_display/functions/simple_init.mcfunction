# Простая инициализация - для ручного запуска
# Выполните: /function gametime_display:simple_init

# Создаем scoreboard
scoreboard objectives add gametime_display dummy "Игровое время"

# Устанавливаем отображение
scoreboard objectives setdisplay sidebar gametime_display

# Инициализируем переменную
scoreboard players set #time gametime_display 0

# Запускаем обновление
function gametime_display:update_time

# Сообщаем игроку
tellraw @a [{"text":"[Gametime] ","color":"yellow"},{"text":"Scoreboard инициализирован!","color":"green"}]

