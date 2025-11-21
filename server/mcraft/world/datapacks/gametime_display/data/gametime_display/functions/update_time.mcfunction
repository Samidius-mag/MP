# Обновление отображения времени игрового мира
# Этот файл запускается каждый тик для обновления scoreboard

# Получаем текущее время дня (0-24000) и сохраняем в scoreboard
execute store result score #time gametime_display run time query daytime

# Показываем время дня напрямую (для проверки работы)
scoreboard players set "⏰ Время дня" gametime_display 0
scoreboard players operation "⏰ Время дня" gametime_display = #time gametime_display

# Вычисляем игровые часы (0-23)
# Формула: часы = (время / 1000) % 24
scoreboard players operation #hours gametime_display = #time gametime_display
scoreboard players operation #hours gametime_display /= #const_1000 gametime_display
scoreboard players operation #hours gametime_display %= #const_24 gametime_display

# Показываем часы
scoreboard players set "⏰ Часы" gametime_display 0
scoreboard players operation "⏰ Часы" gametime_display = #hours gametime_display

# Вычисляем игровые минуты (0-59)
# Формула: минуты = ((время % 1000) / 1000) * 60
scoreboard players operation #minutes_temp gametime_display = #time gametime_display
scoreboard players operation #minutes_temp gametime_display %= #const_1000 gametime_display
scoreboard players operation #minutes_temp gametime_display *= #const_60 gametime_display
scoreboard players operation #minutes gametime_display = #minutes_temp gametime_display
scoreboard players operation #minutes gametime_display /= #const_1000 gametime_display

# Показываем минуты
scoreboard players set "⏰ Минуты" gametime_display 0
scoreboard players operation "⏰ Минуты" gametime_display = #minutes gametime_display
