package com.serverauthshop.data;

import com.serverauthshop.ServerAuthShop;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;

import java.io.File;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

public class PlayerDataManager {
    
    private final ServerAuthShop plugin;
    private final File dataFile;
    private FileConfiguration dataConfig;
    private final Map<UUID, Boolean> loggedInPlayers;
    
    public PlayerDataManager(ServerAuthShop plugin) {
        this.plugin = plugin;
        this.loggedInPlayers = new HashMap<>();
        
        // Создаем папку для данных, если её нет
        if (!plugin.getDataFolder().exists()) {
            plugin.getDataFolder().mkdirs();
        }
        
        // Инициализируем файл данных
        this.dataFile = new File(plugin.getDataFolder(), "players.json");
        loadData();
    }
    
    private void loadData() {
        // Используем YAML для хранения данных (проще чем JSON для Bukkit)
        // Но сохраняем в формате, похожем на JSON структуру
        if (!dataFile.exists()) {
            try {
                dataFile.createNewFile();
            } catch (IOException e) {
                plugin.getLogger().severe("Не удалось создать файл данных: " + e.getMessage());
            }
        }
        
        // Используем YAML конфигурацию для удобства работы с Bukkit API
        dataConfig = YamlConfiguration.loadConfiguration(dataFile);
    }
    
    public void saveData() {
        try {
            dataConfig.save(dataFile);
        } catch (IOException e) {
            plugin.getLogger().severe("Не удалось сохранить данные: " + e.getMessage());
        }
    }
    
    public void savePlayerData(UUID uuid) {
        // Сохраняем данные конкретного игрока
        saveData();
    }
    
    public void saveAll() {
        saveData();
    }
    
    public boolean isPlayerRegistered(UUID uuid) {
        String uuidString = uuid.toString();
        return dataConfig.contains("players." + uuidString + ".username");
    }
    
    public boolean isPlayerLoggedIn(UUID uuid) {
        return loggedInPlayers.getOrDefault(uuid, false);
    }
    
    public void setPlayerLoggedIn(UUID uuid, boolean loggedIn) {
        loggedInPlayers.put(uuid, loggedIn);
    }
    
    public boolean registerPlayer(UUID uuid, String username, String password) {
        if (isPlayerRegistered(uuid)) {
            return false; // Игрок уже зарегистрирован
        }
        
        String uuidString = uuid.toString();
        String hashedPassword = hashPassword(password);
        
        dataConfig.set("players." + uuidString + ".username", username);
        dataConfig.set("players." + uuidString + ".password", hashedPassword);
        dataConfig.set("players." + uuidString + ".deaths", 0);
        dataConfig.set("players." + uuidString + ".kills", 0);
        dataConfig.set("players." + uuidString + ".coins", 0);
        
        saveData();
        return true;
    }
    
    public boolean loginPlayer(UUID uuid, String password) {
        if (!isPlayerRegistered(uuid)) {
            return false;
        }
        
        String uuidString = uuid.toString();
        String storedPassword = dataConfig.getString("players." + uuidString + ".password");
        
        if (storedPassword != null && storedPassword.equals(hashPassword(password))) {
            setPlayerLoggedIn(uuid, true);
            return true;
        }
        
        return false;
    }
    
    public String getPlayerUsername(UUID uuid) {
        String uuidString = uuid.toString();
        return dataConfig.getString("players." + uuidString + ".username", "Unknown");
    }
    
    public int getDeaths(UUID uuid) {
        String uuidString = uuid.toString();
        return dataConfig.getInt("players." + uuidString + ".deaths", 0);
    }
    
    public int getKills(UUID uuid) {
        String uuidString = uuid.toString();
        return dataConfig.getInt("players." + uuidString + ".kills", 0);
    }
    
    public void addDeath(UUID uuid) {
        String uuidString = uuid.toString();
        int deaths = getDeaths(uuid);
        dataConfig.set("players." + uuidString + ".deaths", deaths + 1);
        saveData();
    }
    
    public void addKill(UUID uuid) {
        String uuidString = uuid.toString();
        int kills = getKills(uuid);
        dataConfig.set("players." + uuidString + ".kills", kills + 1);
        saveData();
    }
    
    public double getCoins(UUID uuid) {
        String uuidString = uuid.toString();
        if (dataConfig.contains("players." + uuidString + ".coins")) {
            return dataConfig.getDouble("players." + uuidString + ".coins", 0.0);
        }
        return 0.0;
    }
    
    public void setCoins(UUID uuid, double coins) {
        String uuidString = uuid.toString();
        dataConfig.set("players." + uuidString + ".coins", coins);
        saveData();
    }
    
    private String hashPassword(String password) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(password.getBytes());
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            plugin.getLogger().severe("Ошибка хеширования пароля: " + e.getMessage());
            return password; // В случае ошибки возвращаем исходный пароль (небезопасно, но лучше чем краш)
        }
    }
}

