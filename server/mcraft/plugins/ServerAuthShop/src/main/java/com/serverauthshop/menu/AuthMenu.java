package com.serverauthshop.menu;

import com.serverauthshop.ServerAuthShop;
import com.serverauthshop.data.PlayerDataManager;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryType;
import org.bukkit.event.player.AsyncPlayerChatEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;

import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public class AuthMenu implements Listener {
    
    private final ServerAuthShop plugin;
    private final PlayerDataManager dataManager;
    private final Map<UUID, AuthState> playerStates;
    private final Map<UUID, String> pendingUsernames; // Временное хранение логинов
    
    private enum AuthState {
        WAITING_REGISTER_USERNAME,
        WAITING_REGISTER_PASSWORD,
        WAITING_LOGIN_PASSWORD
    }
    
    public AuthMenu(ServerAuthShop plugin, PlayerDataManager dataManager) {
        this.plugin = plugin;
        this.dataManager = dataManager;
        this.playerStates = new HashMap<>();
        this.pendingUsernames = new HashMap<>();
    }
    
    public void showAuthMenu(Player player) {
        Inventory inv = Bukkit.createInventory(null, 9, "§6Регистрация / Вход");
        
        // Кнопка регистрации
        ItemStack registerButton = new ItemStack(Material.EMERALD_BLOCK);
        ItemMeta registerMeta = registerButton.getItemMeta();
        registerMeta.setDisplayName("§aРегистрация");
        registerMeta.setLore(Arrays.asList(
            "§7Нажмите, чтобы",
            "§7зарегистрироваться"
        ));
        registerButton.setItemMeta(registerMeta);
        inv.setItem(3, registerButton);
        
        // Кнопка входа
        ItemStack loginButton = new ItemStack(Material.DIAMOND_BLOCK);
        ItemMeta loginMeta = loginButton.getItemMeta();
        loginMeta.setDisplayName("§bВход");
        loginMeta.setLore(Arrays.asList(
            "§7Нажмите, чтобы",
            "§7войти в систему"
        ));
        loginButton.setItemMeta(loginMeta);
        inv.setItem(5, loginButton);
        
        player.openInventory(inv);
    }
    
    public void showLoginMenu(Player player) {
        Inventory inv = Bukkit.createInventory(null, 9, "§6Вход в систему");
        
        // Кнопка входа
        ItemStack loginButton = new ItemStack(Material.DIAMOND_BLOCK);
        ItemMeta loginMeta = loginButton.getItemMeta();
        loginMeta.setDisplayName("§bВход");
        loginMeta.setLore(Arrays.asList(
            "§7Нажмите, чтобы",
            "§7войти в систему"
        ));
        loginButton.setItemMeta(loginMeta);
        inv.setItem(4, loginButton);
        
        player.openInventory(inv);
    }
    
    @EventHandler
    public void onInventoryClick(InventoryClickEvent event) {
        if (!(event.getWhoClicked() instanceof Player)) {
            return;
        }
        
        Player player = (Player) event.getWhoClicked();
        Inventory inv = event.getInventory();
        
        if (inv.getType() != InventoryType.CHEST) {
            return;
        }
        
        String title = inv.getView().getTitle();
        
        if (title.equals("§6Регистрация / Вход") || title.equals("§6Вход в систему")) {
            event.setCancelled(true);
            
            ItemStack clicked = event.getCurrentItem();
            if (clicked == null || clicked.getType() == Material.AIR) {
                return;
            }
            
            if (clicked.getType() == Material.EMERALD_BLOCK) {
                // Регистрация
                player.closeInventory();
                player.sendMessage("§a═══════════════════════════");
                player.sendMessage("§aРегистрация");
                player.sendMessage("§7Введите логин в чат:");
                playerStates.put(player.getUniqueId(), AuthState.WAITING_REGISTER_USERNAME);
            } else if (clicked.getType() == Material.DIAMOND_BLOCK) {
                // Вход
                player.closeInventory();
                player.sendMessage("§a═══════════════════════════");
                player.sendMessage("§aВход в систему");
                player.sendMessage("§7Введите пароль в чат:");
                playerStates.put(player.getUniqueId(), AuthState.WAITING_LOGIN_PASSWORD);
            }
        }
    }
    
    @EventHandler
    public void onPlayerChat(AsyncPlayerChatEvent event) {
        Player player = event.getPlayer();
        UUID uuid = player.getUniqueId();
        String message = event.getMessage();
        
        if (!playerStates.containsKey(uuid)) {
            return;
        }
        
        event.setCancelled(true);
        
        AuthState state = playerStates.get(uuid);
        
        if (state == AuthState.WAITING_REGISTER_USERNAME) {
            // Сохраняем логин и просим пароль
            if (message.length() < 3 || message.length() > 16) {
                player.sendMessage("§cЛогин должен быть от 3 до 16 символов!");
                return;
            }
            
            pendingUsernames.put(uuid, message);
            player.sendMessage("§aЛогин установлен: §e" + message);
            player.sendMessage("§aТеперь введите пароль:");
            playerStates.put(uuid, AuthState.WAITING_REGISTER_PASSWORD);
        } else if (state == AuthState.WAITING_REGISTER_PASSWORD) {
            // Регистрируем игрока
            String username = pendingUsernames.get(uuid);
            if (username == null) {
                username = player.getName(); // Fallback
            }
            
            if (message.length() < 4) {
                player.sendMessage("§cПароль должен быть не менее 4 символов!");
                return;
            }
            
            if (dataManager.registerPlayer(uuid, username, message)) {
                player.sendMessage("§a═══════════════════════════");
                player.sendMessage("§aРегистрация успешна!");
                player.sendMessage("§7Добро пожаловать, §e" + username + "§7!");
                dataManager.setPlayerLoggedIn(uuid, true);
                playerStates.remove(uuid);
                pendingUsernames.remove(uuid);
            } else {
                player.sendMessage("§cОшибка регистрации! Возможно, вы уже зарегистрированы.");
                playerStates.remove(uuid);
                pendingUsernames.remove(uuid);
                plugin.getServer().getScheduler().runTask(plugin, () -> {
                    showAuthMenu(player);
                });
            }
        } else if (state == AuthState.WAITING_LOGIN_PASSWORD) {
            // Проверяем пароль
            if (dataManager.loginPlayer(uuid, message)) {
                String username = dataManager.getPlayerUsername(uuid);
                player.sendMessage("§a═══════════════════════════");
                player.sendMessage("§aВход выполнен успешно!");
                player.sendMessage("§7Добро пожаловать, §e" + username + "§7!");
                dataManager.setPlayerLoggedIn(uuid, true);
                playerStates.remove(uuid);
            } else {
                player.sendMessage("§cНеверный пароль!");
                playerStates.remove(uuid);
                plugin.getServer().getScheduler().runTask(plugin, () -> {
                    showLoginMenu(player);
                });
            }
        }
    }
}

