package com.travelersguild.util;

import com.travelersguild.TravelersGuild;
import com.travelersguild.data.Rank;
import com.travelersguild.data.SquadRank;
import org.bukkit.entity.Player;
import org.bukkit.scoreboard.Scoreboard;
import org.bukkit.scoreboard.Team;
import org.bukkit.ChatColor;
import org.bukkit.Bukkit;

import java.util.Set;
import java.util.UUID;

public class NameColorManager {
    
    private final TravelersGuild plugin;
    private final HologramManager hologramManager;
    
    public NameColorManager(TravelersGuild plugin) {
        this.plugin = plugin;
        this.hologramManager = new HologramManager(plugin);
    }
    
    /**
     * Обновляет цвет ника игрока в зависимости от ранга и отряда
     */
    public void updatePlayerNameColor(Player player, Rank rank) {
        updatePlayerNameColor(player, rank, true);
    }
    
    /**
     * Обновляет цвет ника игрока в зависимости от ранга и отряда
     */
    public void updatePlayerNameColor(Player player, Rank rank, boolean updateSquad) {
        if (rank == null) {
            return;
        }
        
        Scoreboard scoreboard = plugin.getServer().getScoreboardManager().getMainScoreboard();
        
        // Получаем информацию об отряде
        String squadName = plugin.getDataManager().getPlayerSquad(player.getUniqueId());
        boolean isSquadLeader = false;
        SquadRank squadRank = null;
        
        if (squadName != null && updateSquad) {
            isSquadLeader = plugin.getDataManager().isSquadLeader(squadName, player.getUniqueId());
            squadRank = plugin.getDataManager().getSquadRank(squadName);
        }
        
        // Создаем команду для игрока - используем одну команду для всего
        // Имя команды на основе ника игрока (уникально для каждого игрока)
        String teamName = "guild_" + player.getName();
        if (teamName.length() > 16) {
            teamName = teamName.substring(0, 16);
        }
        
        // Создаем или получаем команду
        Team team = scoreboard.getTeam(teamName);
        if (team == null) {
            team = scoreboard.registerNewTeam(teamName);
        }
        
        // Устанавливаем цвет ника игрока через цвет команды
        if (rank == Rank.SS) {
            team.setColor(org.bukkit.ChatColor.YELLOW);
        } else {
            team.setColor(rank.getColor());
        }
        
        // Убираем префикс - используем только голограмму для отображения над головой
        team.setPrefix("");
        
        // Формируем суффикс только с отрядом (без ранга) для статистики
        StringBuilder suffix = new StringBuilder();
        if (squadName != null && squadRank != null) {
            suffix.append(" §r");
            if (isSquadLeader) {
                suffix.append("§6♔ ");
            }
            suffix.append(squadRank.getColorCode());
            suffix.append(squadName);
        }
        team.setSuffix(suffix.toString());
        
        // Для отображения в списке игроков (таб) - только ник без префиксов
        player.setPlayerListName(player.getName());
        
        // Для отображения над головой - используем только имя, префикс добавится через team
        player.setDisplayName(player.getName());
        
        // Удаляем игрока из других команд гильдии
        for (Team oldTeam : scoreboard.getTeams()) {
            if ((oldTeam.getName().startsWith("guild_") || oldTeam.getName().startsWith("stats_")) 
                && oldTeam.hasEntry(player.getName()) && !oldTeam.equals(team)) {
                oldTeam.removeEntry(player.getName());
            }
        }
        
        // Добавляем игрока в команду
        if (!team.hasEntry(player.getName())) {
            team.addEntry(player.getName());
        }
        
        // Для ранга SS устанавливаем специальный цвет
        if (rank == Rank.SS) {
            plugin.getServer().getScheduler().runTask(plugin, () -> {
                try {
                    plugin.getServer().dispatchCommand(
                        plugin.getServer().getConsoleSender(),
                        "team modify " + teamName + " color yellow"
                    );
                } catch (Exception e) {
                    // Игнорируем ошибки
                }
            });
        }
        
        // Обновляем голограмму над головой игрока
        if (hologramManager.isEnabled()) {
            hologramManager.updatePlayerHologram(player, rank, squadName, squadRank, isSquadLeader);
        }
    }
    
    /**
     * Получает менеджер голограмм
     */
    public HologramManager getHologramManager() {
        return hologramManager;
    }
    
    /**
     * Обновляет отображение отряда для всех игроков отряда
     */
    public void updateSquadDisplay(String squadName) {
        Set<UUID> members = plugin.getDataManager().getSquadMembers(squadName);
        for (UUID uuid : members) {
            Player member = Bukkit.getPlayer(uuid);
            if (member != null) {
                Rank rank = plugin.getDataManager().getPlayerRank(uuid);
                updatePlayerNameColor(member, rank, true);
            }
        }
    }
}

