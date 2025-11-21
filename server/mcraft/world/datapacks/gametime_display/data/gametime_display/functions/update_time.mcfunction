# Обновление отображения времени игрового мира
# Этот файл запускается каждый тик для обновления scoreboard

# Получаем текущее время дня (0-24000) и сохраняем в scoreboard
execute store result score #time gametime_display run time query daytime

# Вычисляем игровые часы (0-23)
# Игровое время: 0-24000
# Формула: часы = (время / 1000) % 24
scoreboard players operation #hours gametime_display = #time gametime_display
scoreboard players operation #hours gametime_display /= #const_1000 gametime_display
scoreboard players operation #hours gametime_display %= #const_24 gametime_display

# Вычисляем игровые минуты (0-59)
# Формула: минуты = ((время % 1000) / 1000) * 60
scoreboard players operation #minutes_temp gametime_display = #time gametime_display
scoreboard players operation #minutes_temp gametime_display %= #const_1000 gametime_display
scoreboard players operation #minutes_temp gametime_display *= #const_60 gametime_display
scoreboard players operation #minutes gametime_display = #minutes_temp gametime_display
scoreboard players operation #minutes gametime_display /= #const_1000 gametime_display

# Обновляем отображение времени в scoreboard
# Показываем часы
scoreboard players set "⏰ Час" gametime_display 0
scoreboard players operation "⏰ Час" gametime_display = #hours gametime_display

# Показываем минуты
scoreboard players set "⏰ Мин" gametime_display 0
scoreboard players operation "⏰ Мин" gametime_display = #minutes gametime_display

# Показываем общее время дня (для справки)
scoreboard players set "⏰ Тики" gametime_display 0
scoreboard players operation "⏰ Тики" gametime_display = #time gametime_display
