package com.travelersguild.util;

import com.travelersguild.TravelersGuild;
import com.travelersguild.data.Rank;
import org.bukkit.entity.Player;
import org.bukkit.scoreboard.Scoreboard;
import org.bukkit.scoreboard.Team;
import org.bukkit.ChatColor;

public class NameColorManager {
    
    private final TravelersGuild plugin;
    
    public NameColorManager(TravelersGuild plugin) {
        this.plugin = plugin;
    }
    
    /**
     * Обновляет цвет ника игрока в зависимости от ранга
     */
    public void updatePlayerNameColor(Player player, Rank rank) {
        if (rank == null) {
            return;
        }
        
        Scoreboard scoreboard = plugin.getServer().getScoreboardManager().getMainScoreboard();
        String teamName = "guild_" + rank.getCode();
        
        // Создаем или получаем команду для ранга
        Team team = scoreboard.getTeam(teamName);
        if (team == null) {
            team = scoreboard.registerNewTeam(teamName);
            team.setColor(rank.getColor());
            
            // Для ранга SS делаем переливающийся эффект
            if (rank == Rank.SS) {
                // Используем эффект переливания через специальные коды
                team.setPrefix("§e§l");
                team.setSuffix("§r");
                // Также устанавливаем цвет команды
                team.setColor(rank.getColor());
            } else {
                team.setPrefix(rank.getNameColorCode());
                team.setSuffix("§r");
                team.setColor(rank.getColor());
            }
        }
        
        // Удаляем игрока из других команд гильдии
        for (Rank r : Rank.values()) {
            Team oldTeam = scoreboard.getTeam("guild_" + r.getCode());
            if (oldTeam != null && oldTeam.hasEntry(player.getName())) {
                oldTeam.removeEntry(player.getName());
            }
        }
        
        // Добавляем игрока в команду его ранга
        if (!team.hasEntry(player.getName())) {
            team.addEntry(player.getName());
        }
        
        // Для ранга SS устанавливаем специальный цвет
        if (rank == Rank.SS) {
            // Используем команду для установки цвета команды
            plugin.getServer().getScheduler().runTask(plugin, () -> {
                try {
                    plugin.getServer().dispatchCommand(
                        plugin.getServer().getConsoleSender(),
                        "team modify guild_SS color yellow"
                    );
                } catch (Exception e) {
                    // Игнорируем ошибки, если команда не поддерживается
                }
            });
        }
    }
}

