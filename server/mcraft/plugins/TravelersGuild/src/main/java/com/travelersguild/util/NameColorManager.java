package com.travelersguild.util;

import com.travelersguild.TravelersGuild;
import com.travelersguild.data.Rank;
import com.travelersguild.data.SquadRank;
import org.bukkit.entity.Player;
import org.bukkit.scoreboard.Scoreboard;
import org.bukkit.scoreboard.Team;
import org.bukkit.ChatColor;
import org.bukkit.Bukkit;

public class NameColorManager {
    
    private final TravelersGuild plugin;
    
    public NameColorManager(TravelersGuild plugin) {
        this.plugin = plugin;
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
        
        // Создаем уникальное имя команды для комбинации ранга и отряда
        String teamName = "guild_" + rank.getCode();
        if (squadName != null) {
            teamName += "_squad_" + squadName.hashCode();
        }
        
        // Ограничиваем длину имени команды (максимум 16 символов в некоторых версиях)
        if (teamName.length() > 16) {
            teamName = teamName.substring(0, 16);
        }
        
        // Создаем или получаем команду
        Team team = scoreboard.getTeam(teamName);
        if (team == null) {
            team = scoreboard.registerNewTeam(teamName);
            team.setColor(rank.getColor());
        }
        
        // Формируем префикс: корона (если лидер) + название отряда + цвет ранга
        StringBuilder prefix = new StringBuilder();
        
        // Корона для лидера отряда
        if (isSquadLeader) {
            prefix.append("§6♔ "); // Корона
        }
        
        // Название отряда с цветом ранга отряда
        if (squadName != null && squadRank != null) {
            prefix.append(squadRank.getColorCode());
            prefix.append("[");
            prefix.append(squadName);
            prefix.append("] ");
        }
        
        // Цвет ранга игрока
        if (rank == Rank.SS) {
            prefix.append("§e§l");
        } else {
            prefix.append(rank.getNameColorCode());
        }
        
        team.setPrefix(prefix.toString());
        team.setSuffix("§r");
        
        // Удаляем игрока из других команд гильдии
        for (Team oldTeam : scoreboard.getTeams()) {
            if (oldTeam.getName().startsWith("guild_") && oldTeam.hasEntry(player.getName())) {
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

