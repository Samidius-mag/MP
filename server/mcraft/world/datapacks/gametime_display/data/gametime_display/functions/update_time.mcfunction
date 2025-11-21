# Обновление отображения времени игрового мира
# Простая версия - показывает время дня напрямую

# Получаем текущее время дня (0-24000) и сохраняем в scoreboard
execute store result score #time gametime_display run time query daytime

# Показываем время дня напрямую
scoreboard players set "Время дня" gametime_display 0
scoreboard players operation "Время дня" gametime_display = #time gametime_display
