package com.travelersguild.util;

import com.travelersguild.TravelersGuild;
import com.travelersguild.data.Rank;
import com.travelersguild.data.SquadRank;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.entity.ArmorStand;
import org.bukkit.entity.EntityType;
import org.bukkit.entity.Player;
import org.bukkit.scheduler.BukkitTask;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Менеджер для управления голограммами над головой игроков через Armor Stand
 * Использует невидимые Armor Stand для отображения многострочного текста
 */
public class HologramManager {
    
    private final TravelersGuild plugin;
    private final Map<UUID, List<ArmorStand>> playerHolograms; // UUID -> список Armor Stand
    private final Map<UUID, BukkitTask> updateTasks; // UUID -> задача обновления
    private boolean enabled = true;
    
    public HologramManager(TravelersGuild plugin) {
        this.plugin = plugin;
        this.playerHolograms = new HashMap<>();
        this.updateTasks = new HashMap<>();
    }
    
    /**
     * Обновляет голограмму над головой игрока
     */
    public void updatePlayerHologram(Player player, Rank rank, String squadName, SquadRank squadRank, boolean isSquadLeader) {
        if (!enabled || rank == null) {
            return;
        }
        
        UUID uuid = player.getUniqueId();
        
        // Удаляем старые Armor Stand
        removePlayerHologram(player);
        
        // Получаем название гильдии
        String guildName = plugin.getGuildMasterNPC().getGuildName();
        
        // Создаем список строк для отображения
        List<String> lines = new ArrayList<>();
        
        // Строка 1: Название гильдии
        lines.add("§6§l" + guildName);
        
        // Строка 2: Название отряда (если есть)
        if (squadName != null && squadRank != null) {
            StringBuilder squadLine = new StringBuilder();
            if (isSquadLeader) {
                squadLine.append("§6♔ ");
            }
            squadLine.append(squadRank.getColorCode());
            squadLine.append(squadName);
            lines.add(squadLine.toString());
        }
        
        // Строка 3: Ник игрока с цветом ранга
        StringBuilder nameLine = new StringBuilder();
        if (rank == Rank.SS) {
            nameLine.append("§e§l");
        } else {
            nameLine.append(rank.getNameColorCode());
        }
        nameLine.append(player.getName());
        lines.add(nameLine.toString());
        
        // Создаем Armor Stand для каждой строки
        Location baseLocation = player.getLocation();
        List<ArmorStand> armorStands = new ArrayList<>();
        
        // Высота между строками
        double lineHeight = 0.25;
        double startHeight = 2.5 + (lines.size() - 1) * lineHeight;
        
        for (int i = 0; i < lines.size(); i++) {
            Location lineLocation = baseLocation.clone().add(0, startHeight - (i * lineHeight), 0);
            
            // Создаем Armor Stand
            ArmorStand armorStand = (ArmorStand) player.getWorld().spawnEntity(lineLocation, EntityType.ARMOR_STAND);
            
            // Настраиваем Armor Stand
            armorStand.setVisible(false);
            armorStand.setGravity(false);
            armorStand.setCanPickupItems(false);
            armorStand.setCustomNameVisible(true);
            armorStand.setCustomName(lines.get(i));
            armorStand.setMarker(true); // Делаем его маркером (невидимый, не взаимодействует)
            armorStand.setInvulnerable(true);
            armorStand.setCollidable(false);
            armorStand.setSmall(false);
            armorStand.setBasePlate(false);
            armorStand.setArms(false);
            
            armorStands.add(armorStand);
        }
        
        playerHolograms.put(uuid, armorStands);
        
        // Запускаем задачу для периодического обновления позиции
        startUpdateTask(player, armorStands);
    }
    
    /**
     * Запускает задачу для периодического обновления позиции голограммы
     */
    private void startUpdateTask(Player player, List<ArmorStand> armorStands) {
        UUID uuid = player.getUniqueId();
        
        // Отменяем предыдущую задачу, если она есть
        BukkitTask oldTask = updateTasks.get(uuid);
        if (oldTask != null) {
            oldTask.cancel();
        }
        
        // Создаем новую задачу для обновления позиции каждые 2 тика
        BukkitTask task = Bukkit.getScheduler().runTaskTimer(plugin, () -> {
            if (!player.isOnline() || !player.isValid()) {
                removePlayerHologram(player);
                return;
            }
            
            // Проверяем, что Armor Stand еще существуют
            armorStands.removeIf(stand -> !stand.isValid());
            
            if (armorStands.isEmpty()) {
                removePlayerHologram(player);
                return;
            }
            
            // Обновляем позицию всех Armor Stand
            Location baseLocation = player.getLocation();
            double lineHeight = 0.25;
            double startHeight = 2.5 + (armorStands.size() - 1) * lineHeight;
            
            for (int i = 0; i < armorStands.size(); i++) {
                ArmorStand stand = armorStands.get(i);
                if (stand.isValid()) {
                    Location newLocation = baseLocation.clone().add(0, startHeight - (i * lineHeight), 0);
                    stand.teleport(newLocation);
                }
            }
        }, 2L, 2L);
        
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
        
        // Удаляем все Armor Stand
        List<ArmorStand> armorStands = playerHolograms.remove(uuid);
        if (armorStands != null) {
            for (ArmorStand stand : armorStands) {
                if (stand.isValid()) {
                    stand.remove();
                }
            }
        }
    }
    
    /**
     * Удаляет все голограммы (при выключении плагина)
     */
    public void removeAllHolograms() {
        for (UUID uuid : new java.util.HashSet<>(playerHolograms.keySet())) {
            // Отменяем задачу обновления
            BukkitTask task = updateTasks.remove(uuid);
            if (task != null) {
                task.cancel();
            }
            
            // Удаляем все Armor Stand
            List<ArmorStand> armorStands = playerHolograms.remove(uuid);
            if (armorStands != null) {
                for (ArmorStand stand : armorStands) {
                    if (stand.isValid()) {
                        stand.remove();
                    }
                }
            }
        }
    }
    
    /**
     * Проверяет, включена ли система голограмм
     */
    public boolean isEnabled() {
        return enabled;
    }
}

