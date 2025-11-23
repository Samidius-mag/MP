package com.serverauthshop;

import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.event.Listener;
import org.bukkit.event.EventHandler;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.event.player.PlayerDeathEvent;
import org.bukkit.event.entity.EntityDeathEvent;
import org.bukkit.entity.Player;
import org.bukkit.entity.Monster;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;

import com.serverauthshop.data.PlayerDataManager;
import com.serverauthshop.menu.AuthMenu;
import com.serverauthshop.menu.ShopMenu;
import com.serverauthshop.economy.CoinManager;

public class ServerAuthShop extends JavaPlugin implements Listener {
    
    private PlayerDataManager dataManager;
    private CoinManager coinManager;
    private AuthMenu authMenu;
    private ShopMenu shopMenu;
    
    @Override
    public void onEnable() {
        // Инициализация менеджеров
        this.dataManager = new PlayerDataManager(this);
        this.coinManager = new CoinManager(this, dataManager);
        this.authMenu = new AuthMenu(this, dataManager);
        this.shopMenu = new ShopMenu(this, dataManager, coinManager);
        
        // Регистрация событий
        getServer().getPluginManager().registerEvents(this, this);
        getServer().getPluginManager().registerEvents(authMenu, this);
        getServer().getPluginManager().registerEvents(shopMenu, this);
        
        getLogger().info("ServerAuthShop плагин включен!");
    }
    
    @Override
    public void onDisable() {
        // Сохранение данных при выключении
        if (dataManager != null) {
            dataManager.saveAll();
        }
        getLogger().info("ServerAuthShop плагин выключен!");
    }
    
    @EventHandler
    public void onPlayerJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();
        
        // Проверяем, зарегистрирован ли игрок
        if (!dataManager.isPlayerRegistered(player.getUniqueId())) {
            // Показываем меню регистрации/входа
            getServer().getScheduler().runTaskLater(this, () -> {
                authMenu.showAuthMenu(player);
            }, 20L); // Задержка 1 секунда
        } else {
            // Игрок уже зарегистрирован, проверяем авторизацию
            if (!dataManager.isPlayerLoggedIn(player.getUniqueId())) {
                getServer().getScheduler().runTaskLater(this, () -> {
                    authMenu.showLoginMenu(player);
                }, 20L);
            }
        }
    }
    
    @EventHandler
    public void onPlayerQuit(PlayerQuitEvent event) {
        Player player = event.getPlayer();
        // Сохраняем данные игрока при выходе
        dataManager.savePlayerData(player.getUniqueId());
    }
    
    @EventHandler
    public void onPlayerDeath(PlayerDeathEvent event) {
        // Увеличиваем счетчик смертей
        Player player = event.getEntity();
        if (dataManager.isPlayerLoggedIn(player.getUniqueId())) {
            dataManager.addDeath(player.getUniqueId());
        }
    }
    
    @EventHandler
    public void onEntityDeath(EntityDeathEvent event) {
        // Начисляем монеты за убийство монстров
        if (event.getEntity().getKiller() != null) {
            Player killer = event.getEntity().getKiller();
            
            if (dataManager.isPlayerLoggedIn(killer.getUniqueId())) {
                if (event.getEntity() instanceof Monster) {
                    // Увеличиваем счетчик убийств
                    dataManager.addKill(killer.getUniqueId());
                    
                    // Начисляем монеты за убийство монстра
                    int coins = 10; // Базовая награда
                    coinManager.addCoins(killer.getUniqueId(), coins);
                    killer.sendMessage("§a+ " + coins + " монет за убийство монстра!");
                } else if (event.getEntity() instanceof Player) {
                    // Убийство игрока
                    dataManager.addKill(killer.getUniqueId());
                    int coins = 50; // Больше монет за убийство игрока
                    coinManager.addCoins(killer.getUniqueId(), coins);
                    killer.sendMessage("§a+ " + coins + " монет за убийство игрока!");
                }
            }
        }
    }
    
    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!(sender instanceof Player)) {
            sender.sendMessage("Эта команда доступна только игрокам!");
            return true;
        }
        
        Player player = (Player) sender;
        
        if (command.getName().equalsIgnoreCase("shop")) {
            // Проверяем авторизацию
            if (!dataManager.isPlayerLoggedIn(player.getUniqueId())) {
                player.sendMessage("§cВы должны войти в систему!");
                authMenu.showLoginMenu(player);
                return true;
            }
            shopMenu.showShopMenu(player);
            return true;
        }
        
        if (command.getName().equalsIgnoreCase("coins")) {
            // Проверяем авторизацию
            if (!dataManager.isPlayerLoggedIn(player.getUniqueId())) {
                player.sendMessage("§cВы должны войти в систему!");
                return true;
            }
            int coins = coinManager.getCoins(player.getUniqueId());
            player.sendMessage("§6Ваш баланс: §e" + coins + " монет");
            return true;
        }
        
        return false;
    }
    
    public PlayerDataManager getDataManager() {
        return dataManager;
    }
    
    public CoinManager getCoinManager() {
        return coinManager;
    }
    
    public ShopMenu getShopMenu() {
        return shopMenu;
    }
}

