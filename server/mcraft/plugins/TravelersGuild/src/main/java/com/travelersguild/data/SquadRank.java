package com.travelersguild.data;

import org.bukkit.ChatColor;

public enum SquadRank {
    RANK_0(0, "§6Коричневый", ChatColor.GOLD, 3, 0),
    RANK_1(1, "§bГолубой", ChatColor.AQUA, 10, 10000),
    RANK_2(2, "§dФиолетовый", ChatColor.LIGHT_PURPLE, 20, 100000),
    RANK_3(3, "§6Золотой", ChatColor.GOLD, 50, 1000000);
    
    private final int level;
    private final String displayName;
    private final ChatColor color;
    private final int maxMembers;
    private final double upgradeCost;
    
    SquadRank(int level, String displayName, ChatColor color, int maxMembers, double upgradeCost) {
        this.level = level;
        this.displayName = displayName;
        this.color = color;
        this.maxMembers = maxMembers;
        this.upgradeCost = upgradeCost;
    }
    
    public int getLevel() {
        return level;
    }
    
    public String getDisplayName() {
        return displayName;
    }
    
    public ChatColor getColor() {
        return color;
    }
    
    public int getMaxMembers() {
        return maxMembers;
    }
    
    public double getUpgradeCost() {
        return upgradeCost;
    }
    
    public String getColorCode() {
        switch (this) {
            case RANK_0:
                return "§6"; // Коричневый/золотой
            case RANK_1:
                return "§b"; // Голубой
            case RANK_2:
                return "§d"; // Фиолетовый
            case RANK_3:
                return "§6"; // Золотой
            default:
                return "§f";
        }
    }
    
    public static SquadRank getByLevel(int level) {
        for (SquadRank rank : values()) {
            if (rank.level == level) {
                return rank;
            }
        }
        return RANK_0;
    }
    
    public SquadRank getNextRank() {
        if (this == RANK_3) {
            return null; // Максимальный ранг
        }
        return getByLevel(level + 1);
    }
}

