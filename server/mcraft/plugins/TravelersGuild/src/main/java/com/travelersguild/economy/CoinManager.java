package com.travelersguild.economy;

import com.travelersguild.TravelersGuild;
import org.bukkit.Bukkit;
import org.bukkit.plugin.Plugin;

import java.util.UUID;

public class CoinManager {
    
    private final TravelersGuild plugin;
    private Object serverAuthShopPlugin;
    private boolean useServerAuthShop;
    
    public CoinManager(TravelersGuild plugin) {
        this.plugin = plugin;
        
        // Проверяем наличие плагина ServerAuthShop
        Plugin serverAuthShop = Bukkit.getPluginManager().getPlugin("ServerAuthShop");
        if (serverAuthShop != null && serverAuthShop.isEnabled()) {
            this.serverAuthShopPlugin = serverAuthShop;
            this.useServerAuthShop = true;
        } else {
            this.useServerAuthShop = false;
        }
    }
    
    public double getCoins(UUID uuid) {
        if (useServerAuthShop) {
            try {
                // Получаем CoinManager из ServerAuthShop через рефлексию
                Class<?> serverAuthShopClass = Class.forName("com.serverauthshop.ServerAuthShop");
                Object serverAuthShopInstance = serverAuthShopPlugin;
                Object coinManager = serverAuthShopClass.getMethod("getCoinManager").invoke(serverAuthShopInstance);
                
                if (coinManager != null) {
                    return (Double) coinManager.getClass().getMethod("getCoins", UUID.class).invoke(coinManager, uuid);
                }
            } catch (Exception e) {
                // Ошибка при получении монет из ServerAuthShop
            }
        }
        
        // Встроенная система монет (используем данные из GuildDataManager)
        return plugin.getDataManager().getCoins(uuid);
    }
    
    public boolean removeCoins(UUID uuid, double amount) {
        if (useServerAuthShop) {
            try {
                Class<?> serverAuthShopClass = Class.forName("com.serverauthshop.ServerAuthShop");
                Object serverAuthShopInstance = serverAuthShopPlugin;
                Object coinManager = serverAuthShopClass.getMethod("getCoinManager").invoke(serverAuthShopInstance);
                
                if (coinManager != null) {
                    return (Boolean) coinManager.getClass().getMethod("removeCoins", UUID.class, double.class).invoke(coinManager, uuid, amount);
                }
            } catch (Exception e) {
                // Ошибка при списании монет из ServerAuthShop
            }
        }
        
        // Встроенная система монет
        return plugin.getDataManager().removeCoins(uuid, amount);
    }
    
    public boolean hasCoins(UUID uuid, double amount) {
        return getCoins(uuid) >= amount;
    }
    
    public void addCoins(UUID uuid, double amount) {
        if (useServerAuthShop) {
            try {
                Class<?> serverAuthShopClass = Class.forName("com.serverauthshop.ServerAuthShop");
                Object serverAuthShopInstance = serverAuthShopPlugin;
                Object coinManager = serverAuthShopClass.getMethod("getCoinManager").invoke(serverAuthShopInstance);
                
                if (coinManager != null) {
                    coinManager.getClass().getMethod("addCoins", UUID.class, double.class).invoke(coinManager, uuid, amount);
                    return;
                }
            } catch (Exception e) {
                // Ошибка при добавлении монет через ServerAuthShop
            }
        }
        
        // Встроенная система монет
        double current = plugin.getDataManager().getCoins(uuid);
        plugin.getDataManager().setCoins(uuid, current + amount);
    }
}

