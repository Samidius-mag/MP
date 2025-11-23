package com.travelersguild.data;

import com.travelersguild.TravelersGuild;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.io.IOException;
import java.util.*;

public class GuildDataManager {
    
    private final TravelersGuild plugin;
    private final File dataFile;
    private FileConfiguration dataConfig;
    
    // Структура данных для отрядов: название отряда -> список UUID игроков
    private final Map<String, Set<UUID>> squads;
    
    public GuildDataManager(TravelersGuild plugin) {
        this.plugin = plugin;
        this.squads = new HashMap<>();
        
        // Создаем папку для данных, если её нет
        if (!plugin.getDataFolder().exists()) {
            plugin.getDataFolder().mkdirs();
        }
        
        // Инициализируем файл данных
        this.dataFile = new File(plugin.getDataFolder(), "guild_data.yml");
        loadData();
    }
    
    private void loadData() {
        if (!dataFile.exists()) {
            try {
                dataFile.createNewFile();
            } catch (IOException e) {
                plugin.getLogger().severe("Не удалось создать файл данных: " + e.getMessage());
            }
        }
        
        dataConfig = YamlConfiguration.loadConfiguration(dataFile);
        
        // Загружаем отряды
        if (dataConfig.contains("squads")) {
            for (String squadName : dataConfig.getConfigurationSection("squads").getKeys(false)) {
                List<String> memberUuids = dataConfig.getStringList("squads." + squadName);
                Set<UUID> members = new HashSet<>();
                for (String uuidStr : memberUuids) {
                    try {
                        members.add(UUID.fromString(uuidStr));
                    } catch (IllegalArgumentException e) {
                        plugin.getLogger().warning("Неверный UUID в отряде " + squadName + ": " + uuidStr);
                    }
                }
                squads.put(squadName, members);
            }
        }
    }
    
    public void saveData() {
        try {
            // Сохраняем отряды
            for (Map.Entry<String, Set<UUID>> entry : squads.entrySet()) {
                List<String> memberUuids = new ArrayList<>();
                for (UUID uuid : entry.getValue()) {
                    memberUuids.add(uuid.toString());
                }
                dataConfig.set("squads." + entry.getKey(), memberUuids);
            }
            
            dataConfig.save(dataFile);
        } catch (IOException e) {
            plugin.getLogger().severe("Не удалось сохранить данные: " + e.getMessage());
        }
    }
    
    public void savePlayerData(UUID uuid) {
        saveData();
    }
    
    public void saveAll() {
        saveData();
    }
    
    public void reload() {
        loadData();
    }
    
    // === Методы для работы с регистрацией ===
    
    public boolean isPlayerRegistered(UUID uuid) {
        String uuidString = uuid.toString();
        return dataConfig.contains("players." + uuidString + ".registered");
    }
    
    public void registerPlayer(UUID uuid) {
        String uuidString = uuid.toString();
        dataConfig.set("players." + uuidString + ".registered", true);
        dataConfig.set("players." + uuidString + ".monsterKills", 0);
        dataConfig.set("players." + uuidString + ".rank", null);
        saveData();
    }
    
    // === Методы для работы с убийствами ===
    
    public int getMonsterKills(UUID uuid) {
        String uuidString = uuid.toString();
        return dataConfig.getInt("players." + uuidString + ".monsterKills", 0);
    }
    
    public int addMonsterKill(UUID uuid) {
        String uuidString = uuid.toString();
        int kills = getMonsterKills(uuid);
        kills++;
        dataConfig.set("players." + uuidString + ".monsterKills", kills);
        saveData();
        return kills;
    }
    
    // === Методы для работы с рангами ===
    
    public Rank getPlayerRank(UUID uuid) {
        if (!isPlayerRegistered(uuid)) {
            return null;
        }
        
        String uuidString = uuid.toString();
        String rankCode = dataConfig.getString("players." + uuidString + ".rank");
        
        if (rankCode != null) {
            try {
                return Rank.valueOf(rankCode);
            } catch (IllegalArgumentException e) {
                // Если ранг не найден, вычисляем по убийствам
            }
        }
        
        // Вычисляем ранг по убийствам
        int kills = getMonsterKills(uuid);
        Rank rank = Rank.getRankByKills(kills);
        if (rank != null) {
            setPlayerRank(uuid, rank);
        }
        return rank;
    }
    
    public void setPlayerRank(UUID uuid, Rank rank) {
        String uuidString = uuid.toString();
        dataConfig.set("players." + uuidString + ".rank", rank.name());
        saveData();
    }
    
    // === Методы для работы с отрядами ===
    
    public boolean createSquad(String squadName, UUID leaderUuid) {
        if (squads.containsKey(squadName)) {
            return false; // Отряд уже существует
        }
        
        Set<UUID> members = new HashSet<>();
        members.add(leaderUuid);
        squads.put(squadName, members);
        saveData();
        return true;
    }
    
    public boolean joinSquad(String squadName, UUID playerUuid) {
        if (!squads.containsKey(squadName)) {
            return false; // Отряд не существует
        }
        
        squads.get(squadName).add(playerUuid);
        saveData();
        return true;
    }
    
    public boolean leaveSquad(UUID playerUuid) {
        for (Set<UUID> members : squads.values()) {
            if (members.remove(playerUuid)) {
                saveData();
                return true;
            }
        }
        return false;
    }
    
    public boolean disbandSquad(String squadName, UUID leaderUuid) {
        Set<UUID> members = squads.get(squadName);
        if (members == null || !members.contains(leaderUuid)) {
            return false;
        }
        
        squads.remove(squadName);
        saveData();
        return true;
    }
    
    public String getPlayerSquad(UUID playerUuid) {
        for (Map.Entry<String, Set<UUID>> entry : squads.entrySet()) {
            if (entry.getValue().contains(playerUuid)) {
                return entry.getKey();
            }
        }
        return null;
    }
    
    public Set<UUID> getSquadMembers(String squadName) {
        return new HashSet<>(squads.getOrDefault(squadName, new HashSet<>()));
    }
    
    public Set<String> getAllSquads() {
        return new HashSet<>(squads.keySet());
    }
}

