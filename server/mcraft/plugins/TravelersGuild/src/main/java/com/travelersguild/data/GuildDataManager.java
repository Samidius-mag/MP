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
    // Запросы на вступление: название отряда -> список UUID игроков, подавших запрос
    private final Map<String, Set<UUID>> squadJoinRequests;
    
    public GuildDataManager(TravelersGuild plugin) {
        this.plugin = plugin;
        this.squads = new HashMap<>();
        this.squadJoinRequests = new HashMap<>();
        
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
                List<String> memberUuids = dataConfig.getStringList("squads." + squadName + ".members");
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
        
        // Загружаем запросы на вступление
        if (dataConfig.contains("squadJoinRequests")) {
            for (String squadName : dataConfig.getConfigurationSection("squadJoinRequests").getKeys(false)) {
                List<String> requestUuids = dataConfig.getStringList("squadJoinRequests." + squadName);
                Set<UUID> requests = new HashSet<>();
                for (String uuidStr : requestUuids) {
                    try {
                        requests.add(UUID.fromString(uuidStr));
                    } catch (IllegalArgumentException e) {
                        plugin.getLogger().warning("Неверный UUID в запросах отряда " + squadName + ": " + uuidStr);
                    }
                }
                squadJoinRequests.put(squadName, requests);
            }
        }
    }
    
    public void saveData() {
        try {
            // Сохраняем отряды
            for (Map.Entry<String, Set<UUID>> entry : squads.entrySet()) {
                String squadName = entry.getKey();
                List<String> memberUuids = new ArrayList<>();
                for (UUID uuid : entry.getValue()) {
                    memberUuids.add(uuid.toString());
                }
                dataConfig.set("squads." + squadName + ".members", memberUuids);
            }
            
            // Сохраняем запросы на вступление
            for (Map.Entry<String, Set<UUID>> entry : squadJoinRequests.entrySet()) {
                List<String> requestUuids = new ArrayList<>();
                for (UUID uuid : entry.getValue()) {
                    requestUuids.add(uuid.toString());
                }
                dataConfig.set("squadJoinRequests." + entry.getKey(), requestUuids);
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
    
    // === Методы для работы с монетами (встроенная система) ===
    
    public double getCoins(UUID uuid) {
        String uuidString = uuid.toString();
        return dataConfig.getDouble("players." + uuidString + ".coins", 0.0);
    }
    
    public void setCoins(UUID uuid, double coins) {
        String uuidString = uuid.toString();
        dataConfig.set("players." + uuidString + ".coins", coins);
        saveData();
    }
    
    public boolean removeCoins(UUID uuid, double amount) {
        double current = getCoins(uuid);
        if (current >= amount) {
            setCoins(uuid, current - amount);
            return true;
        }
        return false;
    }
    
    // === Методы для работы с отрядами ===
    
    public boolean createSquad(String squadName, UUID leaderUuid) {
        if (squads.containsKey(squadName)) {
            return false; // Отряд уже существует
        }
        
        Set<UUID> members = new HashSet<>();
        members.add(leaderUuid);
        squads.put(squadName, members);
        
        // Инициализируем данные отряда
        String squadPath = "squads." + squadName;
        dataConfig.set(squadPath + ".leader", leaderUuid.toString());
        dataConfig.set(squadPath + ".rank", 0); // Ранг 0 при создании
        dataConfig.set(squadPath + ".treasury", 0.0); // Казна пуста
        dataConfig.set(squadPath + ".joinFee", 0.0); // Сбор при вступлении (устанавливается главой)
        
        saveData();
        return true;
    }
    
    public boolean joinSquad(String squadName, UUID playerUuid) {
        if (!squads.containsKey(squadName)) {
            return false; // Отряд не существует
        }
        
        Set<UUID> members = squads.get(squadName);
        SquadRank squadRank = getSquadRank(squadName);
        
        // Проверяем лимит игроков
        if (members.size() >= squadRank.getMaxMembers()) {
            return false; // Отряд заполнен
        }
        
        members.add(playerUuid);
        
        // Удаляем запрос на вступление
        removeJoinRequest(squadName, playerUuid);
        
        saveData();
        return true;
    }
    
    public boolean addJoinRequest(String squadName, UUID playerUuid) {
        if (!squads.containsKey(squadName)) {
            return false; // Отряд не существует
        }
        
        // Проверяем, не состоит ли уже игрок в отряде
        if (squads.get(squadName).contains(playerUuid)) {
            return false;
        }
        
        // Проверяем, не подал ли уже запрос
        Set<UUID> requests = squadJoinRequests.getOrDefault(squadName, new HashSet<>());
        if (requests.contains(playerUuid)) {
            return false; // Запрос уже подан
        }
        
        requests.add(playerUuid);
        squadJoinRequests.put(squadName, requests);
        saveData();
        return true;
    }
    
    public boolean removeJoinRequest(String squadName, UUID playerUuid) {
        Set<UUID> requests = squadJoinRequests.get(squadName);
        if (requests != null && requests.remove(playerUuid)) {
            if (requests.isEmpty()) {
                squadJoinRequests.remove(squadName);
            }
            saveData();
            return true;
        }
        return false;
    }
    
    public Set<UUID> getJoinRequests(String squadName) {
        return new HashSet<>(squadJoinRequests.getOrDefault(squadName, new HashSet<>()));
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
        
        // Проверяем, что игрок является лидером (первым в списке)
        if (!members.contains(leaderUuid)) {
            return false;
        }
        
        squads.remove(squadName);
        saveData();
        return true;
    }
    
    public UUID getSquadLeader(String squadName) {
        String uuidString = dataConfig.getString("squads." + squadName + ".leader");
        if (uuidString != null) {
            try {
                return UUID.fromString(uuidString);
            } catch (IllegalArgumentException e) {
                // Fallback на первый участник
                Set<UUID> members = squads.get(squadName);
                if (members != null && !members.isEmpty()) {
                    return members.iterator().next();
                }
            }
        }
        return null;
    }
    
    // === Методы для работы с рангами отрядов ===
    
    public SquadRank getSquadRank(String squadName) {
        int rankLevel = dataConfig.getInt("squads." + squadName + ".rank", 0);
        return SquadRank.getByLevel(rankLevel);
    }
    
    public boolean upgradeSquadRank(String squadName, UUID leaderUuid) {
        if (!isSquadLeader(squadName, leaderUuid)) {
            return false;
        }
        
        SquadRank currentRank = getSquadRank(squadName);
        SquadRank nextRank = currentRank.getNextRank();
        
        if (nextRank == null) {
            return false; // Уже максимальный ранг
        }
        
        // Обновляем ранг
        dataConfig.set("squads." + squadName + ".rank", nextRank.getLevel());
        saveData();
        return true;
    }
    
    public boolean isSquadLeader(String squadName, UUID playerUuid) {
        UUID leader = getSquadLeader(squadName);
        return leader != null && leader.equals(playerUuid);
    }
    
    // === Методы для работы с казной отряда ===
    
    public double getSquadTreasury(String squadName) {
        return dataConfig.getDouble("squads." + squadName + ".treasury", 0.0);
    }
    
    public boolean addToSquadTreasury(String squadName, UUID leaderUuid, double amount) {
        if (!isSquadLeader(squadName, leaderUuid)) {
            return false;
        }
        
        double current = getSquadTreasury(squadName);
        dataConfig.set("squads." + squadName + ".treasury", current + amount);
        saveData();
        return true;
    }
    
    public boolean removeFromSquadTreasury(String squadName, UUID leaderUuid, double amount) {
        if (!isSquadLeader(squadName, leaderUuid)) {
            return false;
        }
        
        double current = getSquadTreasury(squadName);
        if (current < amount) {
            return false; // Недостаточно средств
        }
        
        dataConfig.set("squads." + squadName + ".treasury", current - amount);
        saveData();
        return true;
    }
    
    // === Методы для работы со сбором при вступлении ===
    
    public double getSquadJoinFee(String squadName) {
        return dataConfig.getDouble("squads." + squadName + ".joinFee", 0.0);
    }
    
    public boolean setSquadJoinFee(String squadName, UUID leaderUuid, double fee) {
        if (!isSquadLeader(squadName, leaderUuid)) {
            return false;
        }
        
        dataConfig.set("squads." + squadName + ".joinFee", fee);
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

