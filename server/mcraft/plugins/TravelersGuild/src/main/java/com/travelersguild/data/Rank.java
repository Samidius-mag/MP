package com.travelersguild.data;

import org.bukkit.ChatColor;

public enum Rank {
    C("C", "§aНовичок", ChatColor.GREEN, 10),
    B("B", "§9Опытный", ChatColor.BLUE, 100),
    A("A", "§cМастер", ChatColor.RED, 1000),
    S("S", "§6Герой", ChatColor.GOLD, 5000),
    SS("SS", "§e§lУльтра Герой", ChatColor.YELLOW, 10000);
    
    private final String code;
    private final String displayName;
    private final ChatColor color;
    private final int requiredKills;
    
    Rank(String code, String displayName, ChatColor color, int requiredKills) {
        this.code = code;
        this.displayName = displayName;
        this.color = color;
        this.requiredKills = requiredKills;
    }
    
    public String getCode() {
        return code;
    }
    
    public String getDisplayName() {
        return displayName;
    }
    
    public ChatColor getColor() {
        return color;
    }
    
    public int getRequiredKills() {
        return requiredKills;
    }
    
    /**
     * Получить ранг на основе количества убийств
     */
    public static Rank getRankByKills(int kills) {
        if (kills >= SS.requiredKills) {
            return SS;
        } else if (kills >= S.requiredKills) {
            return S;
        } else if (kills >= A.requiredKills) {
            return A;
        } else if (kills >= B.requiredKills) {
            return B;
        } else if (kills >= C.requiredKills) {
            return C;
        }
        return null; // Нет ранга (меньше 10 убийств)
    }
    
    /**
     * Получить цвет для ника в зависимости от ранга
     */
    public String getNameColorCode() {
        switch (this) {
            case C:
                return "§a"; // Зеленый
            case B:
                return "§9"; // Синий
            case A:
                return "§c"; // Красный
            case S:
                return "§6"; // Золотой
            case SS:
                return "§e§l§k§r§e§l"; // Переливающийся (желтый жирный с эффектом)
            default:
                return "§f"; // Белый
        }
    }
}

