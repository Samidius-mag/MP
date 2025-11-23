package com.serverauthshop.menu;

import com.serverauthshop.ServerAuthShop;
import com.serverauthshop.data.PlayerDataManager;
import com.serverauthshop.economy.CoinManager;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryType;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;

import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public class ShopMenu implements Listener {
    
    private final ServerAuthShop plugin;
    private final PlayerDataManager dataManager;
    private final CoinManager coinManager;
    private final Map<UUID, ShopState> playerStates;
    
    private enum ShopState {
        MAIN,
        BUY,
        SELL
    }
    
    // Цены на покупку (сколько монет стоит блок)
    private final Map<Material, Integer> buyPrices = new HashMap<Material, Integer>() {{
        put(Material.DIAMOND, 100);
        put(Material.IRON_INGOT, 20);
        put(Material.GOLD_INGOT, 30);
        put(Material.COAL, 5);
        put(Material.STONE, 2);
        put(Material.OAK_LOG, 3);
        put(Material.BREAD, 5);
        put(Material.APPLE, 3);
    }};
    
    // Цены на продажу (сколько монет дают за блок)
    private final Map<Material, Integer> sellPrices = new HashMap<Material, Integer>() {{
        put(Material.DIAMOND, 50);
        put(Material.IRON_INGOT, 10);
        put(Material.GOLD_INGOT, 15);
        put(Material.COAL, 2);
        put(Material.STONE, 1);
        put(Material.OAK_LOG, 1);
        put(Material.BREAD, 2);
        put(Material.APPLE, 1);
    }};
    
    public ShopMenu(ServerAuthShop plugin, PlayerDataManager dataManager, CoinManager coinManager) {
        this.plugin = plugin;
        this.dataManager = dataManager;
        this.coinManager = coinManager;
        this.playerStates = new HashMap<>();
    }
    
    public void showShopMenu(Player player) {
        Inventory inv = Bukkit.createInventory(null, 27, "§6Магазин");
        
        // Кнопка покупки
        ItemStack buyButton = new ItemStack(Material.EMERALD);
        ItemMeta buyMeta = buyButton.getItemMeta();
        buyMeta.setDisplayName("§aКупить");
        buyMeta.setLore(Arrays.asList(
            "§7Нажмите, чтобы",
            "§7купить предметы"
        ));
        buyButton.setItemMeta(buyMeta);
        inv.setItem(11, buyButton);
        
        // Кнопка продажи
        ItemStack sellButton = new ItemStack(Material.GOLD_INGOT);
        ItemMeta sellMeta = sellButton.getItemMeta();
        sellMeta.setDisplayName("§eПродать");
        sellMeta.setLore(Arrays.asList(
            "§7Нажмите, чтобы",
            "§7продать предметы"
        ));
        sellButton.setItemMeta(sellMeta);
        inv.setItem(15, sellButton);
        
        // Информация о балансе
        int coins = coinManager.getCoins(player.getUniqueId());
        ItemStack balanceInfo = new ItemStack(Material.SUNFLOWER);
        ItemMeta balanceMeta = balanceInfo.getItemMeta();
        balanceMeta.setDisplayName("§6Ваш баланс: §e" + coins + " монет");
        balanceInfo.setItemMeta(balanceMeta);
        inv.setItem(4, balanceInfo);
        
        playerStates.put(player.getUniqueId(), ShopState.MAIN);
        player.openInventory(inv);
    }
    
    public void showBuyMenu(Player player) {
        Inventory inv = Bukkit.createInventory(null, 54, "§aКупить предметы");
        
        int slot = 0;
        for (Map.Entry<Material, Integer> entry : buyPrices.entrySet()) {
            Material material = entry.getKey();
            int price = entry.getValue();
            
            ItemStack item = new ItemStack(material, 1);
            ItemMeta meta = item.getItemMeta();
            meta.setDisplayName("§a" + getMaterialName(material));
            meta.setLore(Arrays.asList(
                "§7Цена: §e" + price + " монет",
                "§7Нажмите, чтобы купить"
            ));
            item.setItemMeta(meta);
            
            inv.setItem(slot, item);
            slot++;
        }
        
        // Кнопка назад
        ItemStack backButton = new ItemStack(Material.BARRIER);
        ItemMeta backMeta = backButton.getItemMeta();
        backMeta.setDisplayName("§cНазад");
        backButton.setItemMeta(backMeta);
        inv.setItem(49, backButton);
        
        playerStates.put(player.getUniqueId(), ShopState.BUY);
        player.openInventory(inv);
    }
    
    public void showSellMenu(Player player) {
        Inventory inv = Bukkit.createInventory(null, 54, "§eПродать предметы");
        
        int slot = 0;
        for (Map.Entry<Material, Integer> entry : sellPrices.entrySet()) {
            Material material = entry.getKey();
            int price = entry.getValue();
            
            ItemStack item = new ItemStack(material, 1);
            ItemMeta meta = item.getItemMeta();
            meta.setDisplayName("§e" + getMaterialName(material));
            meta.setLore(Arrays.asList(
                "§7Цена продажи: §e" + price + " монет",
                "§7Нажмите, чтобы продать",
                "§7(продаст все предметы этого типа)"
            ));
            item.setItemMeta(meta);
            
            inv.setItem(slot, item);
            slot++;
        }
        
        // Кнопка назад
        ItemStack backButton = new ItemStack(Material.BARRIER);
        ItemMeta backMeta = backButton.getItemMeta();
        backMeta.setDisplayName("§cНазад");
        backButton.setItemMeta(backMeta);
        inv.setItem(49, backButton);
        
        playerStates.put(player.getUniqueId(), ShopState.SELL);
        player.openInventory(inv);
    }
    
    @EventHandler
    public void onInventoryClick(InventoryClickEvent event) {
        if (!(event.getWhoClicked() instanceof Player)) {
            return;
        }
        
        Player player = (Player) event.getWhoClicked();
        Inventory inv = event.getInventory();
        UUID uuid = player.getUniqueId();
        
        if (inv.getType() != InventoryType.CHEST) {
            return;
        }
        
        String title = inv.getView().getTitle();
        ItemStack clicked = event.getCurrentItem();
        
        if (clicked == null || clicked.getType() == Material.AIR) {
            return;
        }
        
        if (title.equals("§6Магазин")) {
            event.setCancelled(true);
            
            if (clicked.getType() == Material.EMERALD) {
                // Покупка
                showBuyMenu(player);
            } else if (clicked.getType() == Material.GOLD_INGOT) {
                // Продажа
                showSellMenu(player);
            }
        } else if (title.equals("§aКупить предметы")) {
            event.setCancelled(true);
            
            if (clicked.getType() == Material.BARRIER) {
                // Назад
                showShopMenu(player);
                return;
            }
            
            // Покупка предмета
            Material material = clicked.getType();
            if (buyPrices.containsKey(material)) {
                int price = buyPrices.get(material);
                int coins = coinManager.getCoins(uuid);
                
                if (coins >= price) {
                    coinManager.removeCoins(uuid, price);
                    player.getInventory().addItem(new ItemStack(material, 1));
                    player.sendMessage("§aВы купили " + getMaterialName(material) + " за " + price + " монет!");
                    
                    // Обновляем меню
                    showBuyMenu(player);
                } else {
                    player.sendMessage("§cНедостаточно монет! Нужно: " + price + ", у вас: " + coins);
                }
            }
        } else if (title.equals("§eПродать предметы")) {
            event.setCancelled(true);
            
            if (clicked.getType() == Material.BARRIER) {
                // Назад
                showShopMenu(player);
                return;
            }
            
            // Продажа предмета
            Material material = clicked.getType();
            if (sellPrices.containsKey(material)) {
                int price = sellPrices.get(material);
                int count = countItems(player, material);
                
                if (count > 0) {
                    removeItems(player, material, count);
                    int totalPrice = price * count;
                    coinManager.addCoins(uuid, totalPrice);
                    player.sendMessage("§aВы продали " + count + "x " + getMaterialName(material) + " за " + totalPrice + " монет!");
                    
                    // Обновляем меню
                    showSellMenu(player);
                } else {
                    player.sendMessage("§cУ вас нет этого предмета!");
                }
            }
        }
    }
    
    private int countItems(Player player, Material material) {
        int count = 0;
        for (ItemStack item : player.getInventory().getContents()) {
            if (item != null && item.getType() == material) {
                count += item.getAmount();
            }
        }
        return count;
    }
    
    private void removeItems(Player player, Material material, int amount) {
        for (ItemStack item : player.getInventory().getContents()) {
            if (item != null && item.getType() == material) {
                if (item.getAmount() <= amount) {
                    amount -= item.getAmount();
                    player.getInventory().removeItem(item);
                } else {
                    item.setAmount(item.getAmount() - amount);
                    amount = 0;
                }
                if (amount <= 0) break;
            }
        }
    }
    
    private String getMaterialName(Material material) {
        String name = material.name().toLowerCase().replace("_", " ");
        String[] words = name.split(" ");
        StringBuilder result = new StringBuilder();
        for (String word : words) {
            if (result.length() > 0) result.append(" ");
            result.append(word.substring(0, 1).toUpperCase()).append(word.substring(1));
        }
        return result.toString();
    }
}

