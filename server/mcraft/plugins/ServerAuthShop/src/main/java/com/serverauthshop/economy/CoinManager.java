package com.serverauthshop.economy;

import com.serverauthshop.ServerAuthShop;
import com.serverauthshop.data.PlayerDataManager;

import java.util.UUID;

public class CoinManager {
    
    private final ServerAuthShop plugin;
    private final PlayerDataManager dataManager;
    
    public CoinManager(ServerAuthShop plugin, PlayerDataManager dataManager) {
        this.plugin = plugin;
        this.dataManager = dataManager;
    }
    
    public double getCoins(UUID uuid) {
        return dataManager.getCoins(uuid);
    }
    
    public void setCoins(UUID uuid, double coins) {
        dataManager.setCoins(uuid, coins);
    }
    
    public void addCoins(UUID uuid, double amount) {
        double current = getCoins(uuid);
        setCoins(uuid, current + amount);
    }
    
    public boolean removeCoins(UUID uuid, double amount) {
        double current = getCoins(uuid);
        if (current >= amount) {
            setCoins(uuid, current - amount);
            return true;
        }
        return false;
    }
    
    public boolean hasCoins(UUID uuid, double amount) {
        return getCoins(uuid) >= amount;
    }
}

