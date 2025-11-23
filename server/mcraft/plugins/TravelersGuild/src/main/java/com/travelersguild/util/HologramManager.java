package com.travelersguild.util;

import com.travelersguild.TravelersGuild;
import com.travelersguild.data.Rank;
import com.travelersguild.data.SquadRank;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitTask;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Менеджер для управления голограммами над головой игроков через HolographicDisplays
 */
public class HologramManager {
    
    private final TravelersGuild plugin;
    private final Map<UUID, Object> playerHolograms; // UUID -> Hologram объект
    private final Map<UUID, BukkitTask> updateTasks; // UUID -> задача обновления
    private boolean holographicDisplaysEnabled = false;
    
    public HologramManager(TravelersGuild plugin) {
        this.plugin = plugin;
        this.playerHolograms = new HashMap<>();
        this.updateTasks = new HashMap<>();
        
        // Проверяем наличие HolographicDisplays
        checkHolographicDisplays();
    }
    
    /**
     * Проверяет наличие плагина HolographicDisplays
     */
    private void checkHolographicDisplays() {
        Plugin hdPlugin = Bukkit.getPluginManager().getPlugin("HolographicDisplays");
        if (hdPlugin != null && hdPlugin.isEnabled()) {
            holographicDisplaysEnabled = true;
            plugin.getLogger().info("HolographicDisplays найден! Многострочное отображение над головой включено.");
        } else {
            holographicDisplaysEnabled = false;
            plugin.getLogger().info("HolographicDisplays не найден. Многострочное отображение отключено.");
        }
    }
    
    /**
     * Обновляет голограмму над головой игрока
     */
    public void updatePlayerHologram(Player player, Rank rank, String squadName, SquadRank squadRank, boolean isSquadLeader) {
        if (!holographicDisplaysEnabled || rank == null) {
            return;
        }
        
        try {
            // Используем рефлексию для работы с HolographicDisplays API
            Class<?> hologramsAPIClass = Class.forName("com.gmail.filoghost.holographicdisplays.api.HologramsAPI");
            
            UUID uuid = player.getUniqueId();
            Location location = player.getLocation().add(0, 2.5, 0); // Над головой игрока
            
            // Получаем или создаем голограмму
            Object hologram = playerHolograms.get(uuid);
            
            if (hologram == null) {
                // Создаем новую голограмму
                java.lang.reflect.Method createMethod = hologramsAPIClass.getMethod("createHologram", JavaPlugin.class, Location.class);
                hologram = createMethod.invoke(null, plugin, location);
                playerHolograms.put(uuid, hologram);
            } else {
                // Обновляем локацию голограммы
                java.lang.reflect.Method teleportMethod = hologram.getClass().getMethod("teleport", Location.class);
                teleportMethod.invoke(hologram, location);
                
                // Удаляем все старые строки
                java.lang.reflect.Method removeLineMethod = hologram.getClass().getMethod("removeLine", int.class);
                java.lang.reflect.Method sizeMethod = hologram.getClass().getMethod("size");
                int size = (Integer) sizeMethod.invoke(hologram);
                for (int i = size - 1; i >= 0; i--) {
                    removeLineMethod.invoke(hologram, i);
                }
            }
            
            // Получаем название гильдии
            String guildName = plugin.getGuildMasterNPC().getGuildName();
            
            // Добавляем строки голограммы
            java.lang.reflect.Method appendTextLineMethod = hologram.getClass().getMethod("appendTextLine", String.class);
            
            // Строка 1: Название гильдии
            appendTextLineMethod.invoke(hologram, "§6§l" + guildName);
            
            // Строка 2: Название отряда (если есть)
            if (squadName != null && squadRank != null) {
                StringBuilder squadLine = new StringBuilder();
                if (isSquadLeader) {
                    squadLine.append("§6♔ ");
                }
                squadLine.append(squadRank.getColorCode());
                squadLine.append(squadName);
                appendTextLineMethod.invoke(hologram, squadLine.toString());
            }
            
            // Строка 3: Ник игрока с цветом ранга
            StringBuilder nameLine = new StringBuilder();
            if (rank == Rank.SS) {
                nameLine.append("§e§l");
            } else {
                nameLine.append(rank.getNameColorCode());
            }
            nameLine.append(player.getName());
            appendTextLineMethod.invoke(hologram, nameLine.toString());
            
            // Запускаем задачу для периодического обновления позиции голограммы
            startUpdateTask(player, hologram);
            
        } catch (Exception e) {
            // Если HolographicDisplays не доступен или произошла ошибка, игнорируем
            plugin.getLogger().warning("Не удалось обновить голограмму для игрока " + player.getName() + ": " + e.getMessage());
        }
    }
    
    /**
     * Запускает задачу для периодического обновления позиции голограммы
     */
    private void startUpdateTask(Player player, Object hologram) {
        UUID uuid = player.getUniqueId();
        
        // Отменяем предыдущую задачу, если она есть
        BukkitTask oldTask = updateTasks.get(uuid);
        if (oldTask != null) {
            oldTask.cancel();
        }
        
        // Создаем новую задачу для обновления позиции каждые 5 тиков
        BukkitTask task = Bukkit.getScheduler().runTaskTimer(plugin, () -> {
            if (!player.isOnline()) {
                removePlayerHologram(player);
                return;
            }
            
            try {
                Location location = player.getLocation().add(0, 2.5, 0);
                java.lang.reflect.Method teleportMethod = hologram.getClass().getMethod("teleport", Location.class);
                teleportMethod.invoke(hologram, location);
            } catch (Exception e) {
                // Игнорируем ошибки
            }
        }, 5L, 5L);
        
        updateTasks.put(uuid, task);
    }
    
    /**
     * Удаляет голограмму игрока
     */
    public void removePlayerHologram(Player player) {
        UUID uuid = player.getUniqueId();
        
        // Отменяем задачу обновления
        BukkitTask task = updateTasks.remove(uuid);
        if (task != null) {
            task.cancel();
        }
        
        // Удаляем голограмму
        Object hologram = playerHolograms.remove(uuid);
        if (hologram != null) {
            try {
                java.lang.reflect.Method deleteMethod = hologram.getClass().getMethod("delete");
                deleteMethod.invoke(hologram);
            } catch (Exception e) {
                // Игнорируем ошибки
            }
        }
    }
    
    /**
     * Удаляет все голограммы (при выключении плагина)
     */
    public void removeAllHolograms() {
        for (UUID uuid : new java.util.HashSet<>(playerHolograms.keySet())) {
            Player player = Bukkit.getPlayer(uuid);
            if (player != null) {
                removePlayerHologram(player);
            }
        }
    }
    
    /**
     * Проверяет, включен ли HolographicDisplays
     */
    public boolean isHolographicDisplaysEnabled() {
        return holographicDisplaysEnabled;
    }
}

