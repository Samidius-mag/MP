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
    
    // Цены на покупку (сколько монет стоит блок или стак)
    private final Map<Material, Double> buyPrices = new HashMap<Material, Double>() {{
        // Дорогие ресурсы
        put(Material.DIAMOND, 1000.0);
        put(Material.IRON_INGOT, 100.0);
        put(Material.GOLD_INGOT, 150.0);
        put(Material.EMERALD, 800.0);
        put(Material.NETHERITE_INGOT, 5000.0);
        
        // Руды
        put(Material.COAL, 5.0);
        put(Material.LAPIS_LAZULI, 10.0);
        put(Material.REDSTONE, 3.0);
        put(Material.QUARTZ, 8.0);
        
        // Блоки
        put(Material.STONE, 2.0);
        put(Material.COBBLESTONE, 1.0);
        put(Material.DIRT, 0.01 / 64.0); // 0.01 за стак = 0.00015625 за штуку
        put(Material.GRASS_BLOCK, 0.5);
        put(Material.SAND, 0.5);
        put(Material.GRAVEL, 0.3);
        
        // Дерево (0.1 за стак = 0.0015625 за штуку)
        put(Material.OAK_LOG, 0.1 / 64.0);
        put(Material.BIRCH_LOG, 0.1 / 64.0);
        put(Material.SPRUCE_LOG, 0.1 / 64.0);
        put(Material.JUNGLE_LOG, 0.1 / 64.0);
        put(Material.ACACIA_LOG, 0.1 / 64.0);
        put(Material.DARK_OAK_LOG, 0.1 / 64.0);
        put(Material.CHERRY_LOG, 0.1 / 64.0);
        put(Material.MANGROVE_LOG, 0.1 / 64.0);
        
        // Еда
        put(Material.BREAD, 5.0);
        put(Material.APPLE, 3.0);
        put(Material.COOKED_BEEF, 10.0);
        put(Material.COOKED_PORKCHOP, 10.0);
        put(Material.GOLDEN_APPLE, 500.0);
        
        // Другое
        put(Material.ARROW, 1.0);
        put(Material.STRING, 2.0);
        put(Material.LEATHER, 5.0);
        put(Material.FEATHER, 1.0);
    }};
    
    // Цены на продажу (сколько монет дают за блок или стак)
    private final Map<Material, Double> sellPrices = new HashMap<Material, Double>() {{
        // Дорогие ресурсы (50% от цены покупки)
        put(Material.DIAMOND, 500.0);
        put(Material.IRON_INGOT, 50.0);
        put(Material.GOLD_INGOT, 75.0);
        put(Material.EMERALD, 400.0);
        put(Material.NETHERITE_INGOT, 2500.0);
        
        // Руды
        put(Material.COAL, 2.0);
        put(Material.LAPIS_LAZULI, 5.0);
        put(Material.REDSTONE, 1.0);
        put(Material.QUARTZ, 4.0);
        
        // Блоки
        put(Material.STONE, 1.0);
        put(Material.COBBLESTONE, 0.5);
        put(Material.DIRT, 0.005 / 64.0); // 50% от покупки
        put(Material.GRASS_BLOCK, 0.25);
        put(Material.SAND, 0.25);
        put(Material.GRAVEL, 0.15);
        
        // Дерево (50% от покупки)
        put(Material.OAK_LOG, 0.05 / 64.0);
        put(Material.BIRCH_LOG, 0.05 / 64.0);
        put(Material.SPRUCE_LOG, 0.05 / 64.0);
        put(Material.JUNGLE_LOG, 0.05 / 64.0);
        put(Material.ACACIA_LOG, 0.05 / 64.0);
        put(Material.DARK_OAK_LOG, 0.05 / 64.0);
        put(Material.CHERRY_LOG, 0.05 / 64.0);
        put(Material.MANGROVE_LOG, 0.05 / 64.0);
        
        // Еда
        put(Material.BREAD, 2.0);
        put(Material.APPLE, 1.0);
        put(Material.COOKED_BEEF, 5.0);
        put(Material.COOKED_PORKCHOP, 5.0);
        put(Material.GOLDEN_APPLE, 250.0);
        
        // Другое
        put(Material.ARROW, 0.5);
        put(Material.STRING, 1.0);
        put(Material.LEATHER, 2.0);
        put(Material.FEATHER, 0.5);
    }};
    
    // Карта русских названий материалов
    private final Map<Material, String> materialNames = new HashMap<Material, String>() {{
        put(Material.DIAMOND, "Алмаз");
        put(Material.IRON_INGOT, "Железный слиток");
        put(Material.GOLD_INGOT, "Золотой слиток");
        put(Material.EMERALD, "Изумруд");
        put(Material.NETHERITE_INGOT, "Незеритовый слиток");
        put(Material.COAL, "Уголь");
        put(Material.LAPIS_LAZULI, "Лазурит");
        put(Material.REDSTONE, "Редстоун");
        put(Material.QUARTZ, "Кварц");
        put(Material.STONE, "Камень");
        put(Material.COBBLESTONE, "Булыжник");
        put(Material.DIRT, "Земля");
        put(Material.GRASS_BLOCK, "Трава");
        put(Material.SAND, "Песок");
        put(Material.GRAVEL, "Гравий");
        put(Material.OAK_LOG, "Дубовое бревно");
        put(Material.BIRCH_LOG, "Березовое бревно");
        put(Material.SPRUCE_LOG, "Еловое бревно");
        put(Material.JUNGLE_LOG, "Тропическое бревно");
        put(Material.ACACIA_LOG, "Акациевое бревно");
        put(Material.DARK_OAK_LOG, "Темное дубовое бревно");
        put(Material.CHERRY_LOG, "Вишневое бревно");
        put(Material.MANGROVE_LOG, "Мангровое бревно");
        put(Material.BREAD, "Хлеб");
        put(Material.APPLE, "Яблоко");
        put(Material.COOKED_BEEF, "Жареная говядина");
        put(Material.COOKED_PORKCHOP, "Жареная свинина");
        put(Material.GOLDEN_APPLE, "Золотое яблоко");
        put(Material.ARROW, "Стрела");
        put(Material.STRING, "Нить");
        put(Material.LEATHER, "Кожа");
        put(Material.FEATHER, "Перо");
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
        double coins = coinManager.getCoins(player.getUniqueId());
        ItemStack balanceInfo = new ItemStack(Material.SUNFLOWER);
        ItemMeta balanceMeta = balanceInfo.getItemMeta();
        balanceMeta.setDisplayName("§6Ваш баланс: §e" + formatPrice(coins) + " монет");
        balanceInfo.setItemMeta(balanceMeta);
        inv.setItem(4, balanceInfo);
        
        playerStates.put(player.getUniqueId(), ShopState.MAIN);
        player.openInventory(inv);
    }
    
    public void showBuyMenu(Player player) {
        Inventory inv = Bukkit.createInventory(null, 54, "§aКупить предметы");
        
        int slot = 0;
        for (Map.Entry<Material, Double> entry : buyPrices.entrySet()) {
            Material material = entry.getKey();
            double price = entry.getValue();
            
            // Определяем количество (стак или 1 штука)
            int amount = 1;
            String priceText;
            if (material == Material.DIRT || material.name().endsWith("_LOG")) {
                amount = 64; // Покупаем стаками
                double stackPrice = price * 64;
                priceText = formatPrice(stackPrice) + " монет за стак (64 шт)";
            } else {
                priceText = formatPrice(price) + " монет за штуку";
            }
            
            ItemStack item = new ItemStack(material, amount);
            ItemMeta meta = item.getItemMeta();
            meta.setDisplayName("§a" + getMaterialName(material));
            meta.setLore(Arrays.asList(
                "§7Цена: §e" + priceText,
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
        for (Map.Entry<Material, Double> entry : sellPrices.entrySet()) {
            Material material = entry.getKey();
            double price = entry.getValue();
            
            // Определяем количество для отображения
            String priceText;
            if (material == Material.DIRT || material.name().endsWith("_LOG")) {
                double stackPrice = price * 64;
                priceText = formatPrice(stackPrice) + " монет за стак (64 шт)";
            } else {
                priceText = formatPrice(price) + " монет за штуку";
            }
            
            ItemStack item = new ItemStack(material, 1);
            ItemMeta meta = item.getItemMeta();
            meta.setDisplayName("§e" + getMaterialName(material));
            meta.setLore(Arrays.asList(
                "§7Цена продажи: §e" + priceText,
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
        
        String title = event.getView().getTitle();
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
                double price = buyPrices.get(material);
                int amount = 1;
                
                // Для земли и дерева покупаем стаками
                if (material == Material.DIRT || material.name().endsWith("_LOG")) {
                    amount = 64;
                    price = price * 64;
                }
                
                double coins = coinManager.getCoins(uuid);
                
                if (coins >= price - 0.001) { // Небольшая погрешность для double
                    coinManager.removeCoins(uuid, price);
                    player.getInventory().addItem(new ItemStack(material, amount));
                    player.sendMessage("§aВы купили " + amount + "x " + getMaterialName(material) + " за " + formatPrice(price) + " монет!");
                    
                    // Обновляем меню
                    showBuyMenu(player);
                } else {
                    player.sendMessage("§cНедостаточно монет! Нужно: " + formatPrice(price) + ", у вас: " + formatPrice(coins));
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
                double pricePerUnit = sellPrices.get(material);
                int count = countItems(player, material);
                
                if (count > 0) {
                    removeItems(player, material, count);
                    double totalPrice = pricePerUnit * count;
                    coinManager.addCoins(uuid, totalPrice);
                    player.sendMessage("§aВы продали " + count + "x " + getMaterialName(material) + " за " + formatPrice(totalPrice) + " монет!");
                    
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
        // Используем русские названия из карты
        if (materialNames.containsKey(material)) {
            return materialNames.get(material);
        }
        // Если названия нет в карте, генерируем из английского
        String name = material.name().toLowerCase().replace("_", " ");
        String[] words = name.split(" ");
        StringBuilder result = new StringBuilder();
        for (String word : words) {
            if (result.length() > 0) result.append(" ");
            result.append(word.substring(0, 1).toUpperCase()).append(word.substring(1));
        }
        return result.toString();
    }
    
    private String formatPrice(double price) {
        if (price < 1.0) {
            return String.format("%.2f", price);
        } else if (price == (int) price) {
            return String.valueOf((int) price);
        } else {
            return String.format("%.2f", price);
        }
    }
}

