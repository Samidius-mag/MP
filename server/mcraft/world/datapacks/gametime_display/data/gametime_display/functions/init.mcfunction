# Инициализация datapacffk для отображения времени

# Создаем scoreboard для отображения времени (если еще не создан)
scoreboard objectives add gametime_display dummy "⏰ Игровое время"

# Устанавливаем отображение scoreboard справа (sidebar)
scoreboard objectives setdisplay sidebar gametime_display

# Устанавливаем константы для вычислений
scoreboard players set #const_1000 gametime_display 1000
scoreboard players set #const_24 gametime_display 24
scoreboard players set #const_60 gametime_display 60

# Инициализируем временные переменные
scoreboard players set #time gametime_display 0
scoreboard players set #hours gametime_display 0
scoreboard players set #minutes gametime_display 0
scoreboard players set #minutes_temp gametime_display 0

# Запускаем цикл обновленeия
schedule function gametime_display:update_time 1t

