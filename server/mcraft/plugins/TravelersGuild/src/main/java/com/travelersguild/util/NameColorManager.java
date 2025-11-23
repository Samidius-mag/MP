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
        
        // Формируем display name для отображения над головой игрока
        // Формат: 
        // Строка 1: Название гильдии
        // Строка 2: Название отряда (если есть)
        // Строка 3: Ник игрока (с цветом ранга)
        
        StringBuilder displayName = new StringBuilder();
        
        // Получаем название гильдии
        String guildName = plugin.getGuildMasterNPC().getGuildName();
        
        // Строка 1: Название гильдии
        displayName.append("§6§l");
        displayName.append(guildName);
        displayName.append("\n"); // Перенос строки
        
        // Строка 2: Название отряда (если есть)
        if (squadName != null && squadRank != null) {
            // Корона для лидера отряда
            if (isSquadLeader) {
                displayName.append("§6♔ "); // Корона
            }
            displayName.append(squadRank.getColorCode());
            displayName.append(squadName);
            displayName.append("\n"); // Перенос строки
        }
        
        // Строка 3: Ник игрока с цветом ранга
        if (rank == Rank.SS) {
            displayName.append("§e§l");
        } else {
            displayName.append(rank.getNameColorCode());
        }
        displayName.append(player.getName());
        
        // Устанавливаем display name игрока
        player.setDisplayName(displayName.toString());
        player.setPlayerListName(displayName.toString());
        
        // Также устанавливаем префикс для Teams (для таба)
        StringBuilder prefix = new StringBuilder();
        prefix.append("§6§l");
        prefix.append(guildName);
        prefix.append(" ");
        if (squadName != null && squadRank != null) {
            if (isSquadLeader) {
                prefix.append("§6♔ ");
            }
            prefix.append(squadRank.getColorCode());
            prefix.append(squadName);
            prefix.append(" ");
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

