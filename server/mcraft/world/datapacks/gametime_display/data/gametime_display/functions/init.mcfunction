# Инициализация datapack для отображения времени

# Создаем scoreboard для отображения времени (если еще не создан)
scoreboard objectives add gametime_display dummy "Игровое время"

# Устанавливаем отображение scoreboard справа (sidebar)
scoreboard objectives setdisplay sidebar gametime_display

# Инициализируем переменную времени
scoreboard players set #time gametime_display 0

# Запускаем цикл обновления
schedule function gametime_display:update_time 1t
