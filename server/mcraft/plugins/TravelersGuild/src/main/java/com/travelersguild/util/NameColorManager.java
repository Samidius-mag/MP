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
        String teamNameBase = "guild_" + rank.getCode();
        if (squadName != null) {
            teamNameBase += "_squad_" + squadName.hashCode();
        }
        
        // Ограничиваем длину имени команды (максимум 16 символов в некоторых версиях)
        final String teamName = teamNameBase.length() > 16 ? teamNameBase.substring(0, 16) : teamNameBase;
        
        // Создаем или получаем команду
        Team team = scoreboard.getTeam(teamName);
        if (team == null) {
            team = scoreboard.registerNewTeam(teamName);
            team.setColor(rank.getColor());
        }
        
        // Получаем название гильдии
        String guildName = plugin.getGuildMasterNPC().getGuildName();
        
        // Формируем префикс для отображения над головой игрока через scoreboard teams
        // Формат в одну строку: [Гильдия] [Отряд] Ник
        // В Minecraft нельзя использовать многострочный текст, поэтому используем структурированный формат
        StringBuilder prefix = new StringBuilder();
        
        // Название гильдии
        prefix.append("§6§l");
        prefix.append(guildName);
        prefix.append(" §r");
        
        // Название отряда (если есть)
        if (squadName != null && squadRank != null) {
            if (isSquadLeader) {
                prefix.append("§6♔ ");
            }
            prefix.append(squadRank.getColorCode());
            prefix.append(squadName);
            prefix.append(" §r");
        }
        
        // Устанавливаем префикс (будет отображаться перед именем)
        team.setPrefix(prefix.toString());
        
        // Устанавливаем цвет ника игрока через цвет команды
        if (rank == Rank.SS) {
            team.setColor(org.bukkit.ChatColor.YELLOW);
        } else {
            team.setColor(rank.getColor());
        }
        
        // Для отображения в списке игроков (таб) - только ник без префиксов
        player.setPlayerListName(player.getName());
        
        // Для отображения над головой - используем только имя, префикс добавится через team
        player.setDisplayName(player.getName());
        
        // Создаем отдельную команду для статистики без префиксов
        // Это нужно для scoreboard статистики, чтобы отображался только ник
        String statsTeamName = "stats_" + player.getName();
        if (statsTeamName.length() > 16) {
            statsTeamName = statsTeamName.substring(0, 16);
        }
        
        Team statsTeam = scoreboard.getTeam(statsTeamName);
        if (statsTeam == null) {
            statsTeam = scoreboard.registerNewTeam(statsTeamName);
        }
        
        // Убираем префиксы для статистики
        statsTeam.setPrefix("");
        statsTeam.setSuffix("");
        
        // Добавляем игрока в команду статистики
        if (!statsTeam.hasEntry(player.getName())) {
            statsTeam.addEntry(player.getName());
        }
        
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

