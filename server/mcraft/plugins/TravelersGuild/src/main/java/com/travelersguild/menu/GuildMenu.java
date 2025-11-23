package com.travelersguild.menu;

import com.travelersguild.TravelersGuild;
import com.travelersguild.data.GuildDataManager;
import com.travelersguild.data.Rank;
import com.travelersguild.economy.CoinManager;
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

import java.util.*;

public class GuildMenu implements Listener {
    
    private final TravelersGuild plugin;
    private final GuildDataManager dataManager;
    private final CoinManager coinManager;
    private final Map<UUID, MenuState> playerStates;
    private final Map<UUID, String> pendingSquadNames;
    
    private enum MenuState {
        WAITING_SQUAD_NAME,
        WAITING_SQUAD_JOIN_NAME
    }
    
    public GuildMenu(TravelersGuild plugin, GuildDataManager dataManager, CoinManager coinManager) {
        this.plugin = plugin;
        this.dataManager = dataManager;
        this.coinManager = coinManager;
        this.playerStates = new HashMap<>();
        this.pendingSquadNames = new HashMap<>();
    }
    
    public void showMainMenu(Player player) {
        UUID uuid = player.getUniqueId();
        boolean isRegistered = dataManager.isPlayerRegistered(uuid);
        Rank rank = dataManager.getPlayerRank(uuid);
        int kills = dataManager.getMonsterKills(uuid);
        String squadName = dataManager.getPlayerSquad(uuid);
        
        Inventory inv = Bukkit.createInventory(null, 27, "§6§lГильдия Путешественников");
        
        if (!isRegistered) {
            // Меню для незарегистрированных игроков
            ItemStack registerButton = new ItemStack(Material.EMERALD);
            ItemMeta registerMeta = registerButton.getItemMeta();
            registerMeta.setDisplayName("§aЗарегистрироваться как Искатель Приключений");
            registerMeta.setLore(Arrays.asList(
                "§7Нажмите, чтобы",
                "§7зарегистрироваться в гильдии",
                "",
                "§7Требования:",
                "§7- Убить минимум 10 монстров"
            ));
            registerButton.setItemMeta(registerMeta);
            inv.setItem(13, registerButton);
        } else {
            // Меню для зарегистрированных игроков
            
            // Информация о ранге
            Material rankMaterial = Material.IRON_INGOT;
            if (rank == Rank.SS) rankMaterial = Material.NETHERITE_INGOT;
            else if (rank == Rank.S) rankMaterial = Material.GOLD_INGOT;
            else if (rank == Rank.A) rankMaterial = Material.DIAMOND;
            else if (rank == Rank.B) rankMaterial = Material.LAPIS_LAZULI;
            else if (rank == Rank.C) rankMaterial = Material.EMERALD;
            
            ItemStack rankInfo = new ItemStack(rankMaterial);
            ItemMeta rankMeta = rankInfo.getItemMeta();
            rankMeta.setDisplayName("§6Ваш Ранг: " + (rank != null ? rank.getDisplayName() : "§7Нет ранга"));
            List<String> rankLore = new ArrayList<>();
            rankLore.add("§7Убийств монстров: §e" + kills);
            if (rank != null) {
                rankLore.add("");
                rankLore.add("§7Текущий ранг: " + rank.getDisplayName());
                Rank nextRank = getNextRank(rank);
                if (nextRank != null) {
                    int needed = nextRank.getRequiredKills() - kills;
                    rankLore.add("§7До следующего ранга: §e" + needed + " убийств");
                } else {
                    rankLore.add("§7Вы достигли максимального ранга!");
                }
            } else {
                rankLore.add("");
                rankLore.add("§7Для получения ранга C нужно:");
                rankLore.add("§7Убить §e" + (Rank.C.getRequiredKills() - kills) + " §7монстров");
            }
            rankMeta.setLore(rankLore);
            rankInfo.setItemMeta(rankMeta);
            inv.setItem(4, rankInfo);
            
            // Повышение ранга
            if (rank != null) {
                Rank nextRank = getNextRank(rank);
                if (nextRank != null && kills >= nextRank.getRequiredKills()) {
                    ItemStack upgradeButton = new ItemStack(Material.ANVIL);
                    ItemMeta upgradeMeta = upgradeButton.getItemMeta();
                    upgradeMeta.setDisplayName("§aПовысить Ранг");
                    upgradeMeta.setLore(Arrays.asList(
                        "§7Нажмите, чтобы",
                        "§7повысить ранг до " + nextRank.getDisplayName(),
                        "",
                        "§7У вас достаточно убийств!"
                    ));
                    upgradeButton.setItemMeta(upgradeMeta);
                    inv.setItem(11, upgradeButton);
                }
            }
            
            // Управление отрядом
            ItemStack squadButton = new ItemStack(Material.WHITE_BANNER);
            ItemMeta squadMeta = squadButton.getItemMeta();
            if (squadName != null) {
                squadMeta.setDisplayName("§bВаш Отряд: §e" + squadName);
                Set<UUID> members = dataManager.getSquadMembers(squadName);
                List<String> squadLore = new ArrayList<>();
                squadLore.add("§7Члены отряда:");
                for (UUID memberUuid : members) {
                    Player member = Bukkit.getPlayer(memberUuid);
                    if (member != null) {
                        squadLore.add("§7- §a" + member.getName());
                    } else {
                        squadLore.add("§7- §8" + Bukkit.getOfflinePlayer(memberUuid).getName() + " (оффлайн)");
                    }
                }
                squadLore.add("");
                squadLore.add("§cНажмите, чтобы покинуть отряд");
                squadMeta.setLore(squadLore);
            } else {
                squadMeta.setDisplayName("§bУправление Отрядом");
                squadMeta.setLore(Arrays.asList(
                    "§7Нажмите, чтобы",
                    "§7создать или вступить в отряд"
                ));
            }
            squadButton.setItemMeta(squadMeta);
            inv.setItem(15, squadButton);
        }
        
        player.openInventory(inv);
    }
    
    private Rank getNextRank(Rank currentRank) {
        switch (currentRank) {
            case C: return Rank.B;
            case B: return Rank.A;
            case A: return Rank.S;
            case S: return Rank.SS;
            case SS: return null;
            default: return Rank.C;
        }
    }
    
    public void showSquadMenu(Player player) {
        UUID uuid = player.getUniqueId();
        String currentSquad = dataManager.getPlayerSquad(uuid);
        
        Inventory inv = Bukkit.createInventory(null, 27, "§6§lУправление Отрядом");
        
        if (currentSquad == null) {
            // Создать отряд
            ItemStack createButton = new ItemStack(Material.EMERALD_BLOCK);
            ItemMeta createMeta = createButton.getItemMeta();
            createMeta.setDisplayName("§aСоздать Отряд");
            createMeta.setLore(Arrays.asList(
                "§7Нажмите, чтобы",
                "§7создать новый отряд",
                "",
                "§cСтоимость: 1000 монет"
            ));
            createButton.setItemMeta(createMeta);
            inv.setItem(11, createButton);
            
            // Вступить в отряд
            ItemStack joinButton = new ItemStack(Material.DIAMOND_BLOCK);
            ItemMeta joinMeta = joinButton.getItemMeta();
            joinMeta.setDisplayName("§bВступить в Отряд");
            joinMeta.setLore(Arrays.asList(
                "§7Нажмите, чтобы",
                "§7вступить в существующий отряд"
            ));
            joinButton.setItemMeta(joinMeta);
            inv.setItem(15, joinButton);
        } else {
            // Проверяем, является ли игрок лидером
            UUID leaderUuid = dataManager.getSquadLeader(currentSquad);
            boolean isLeader = leaderUuid != null && leaderUuid.equals(uuid);
            
            if (isLeader) {
                // Роспуск отряда (для лидера)
                ItemStack disbandButton = new ItemStack(Material.TNT);
                ItemMeta disbandMeta = disbandButton.getItemMeta();
                disbandMeta.setDisplayName("§c§lРоспустить Отряд");
                disbandMeta.setLore(Arrays.asList(
                    "§7Нажмите, чтобы",
                    "§7распустить отряд: §e" + currentSquad,
                    "",
                    "§cВнимание: это действие",
                    "§cнельзя отменить!"
                ));
                disbandButton.setItemMeta(disbandMeta);
                inv.setItem(11, disbandButton);
            }
            
            // Покинуть отряд
            ItemStack leaveButton = new ItemStack(Material.REDSTONE_BLOCK);
            ItemMeta leaveMeta = leaveButton.getItemMeta();
            leaveMeta.setDisplayName("§cПокинуть Отряд");
            leaveMeta.setLore(Arrays.asList(
                "§7Нажмите, чтобы",
                "§7покинуть отряд: §e" + currentSquad
            ));
            leaveButton.setItemMeta(leaveMeta);
            inv.setItem(15, leaveButton);
        }
        
        player.openInventory(inv);
    }
    
    @EventHandler
    public void onInventoryClick(InventoryClickEvent event) {
        if (!(event.getWhoClicked() instanceof Player)) {
            return;
        }
        
        Player player = (Player) event.getWhoClicked();
        Inventory inv = event.getInventory();
        String title = event.getView().getTitle();
        
        if (title.equals("§6§lГильдия Путешественников") || title.equals("§6§lУправление Отрядом")) {
            event.setCancelled(true);
            
            ItemStack clicked = event.getCurrentItem();
            if (clicked == null || clicked.getType() == Material.AIR) {
                return;
            }
            
            UUID uuid = player.getUniqueId();
            
            if (title.equals("§6§lГильдия Путешественников")) {
                // Главное меню
                if (clicked.getType() == Material.EMERALD && clicked.getItemMeta().getDisplayName().contains("Зарегистрироваться")) {
                    // Регистрация
                    int kills = dataManager.getMonsterKills(uuid);
                    if (kills < 10) {
                        player.sendMessage("§cДля регистрации нужно убить минимум 10 монстров!");
                        player.sendMessage("§7У вас убито: §e" + kills + " §7монстров");
                        player.closeInventory();
                        return;
                    }
                    
                    dataManager.registerPlayer(uuid);
                    Rank rank = Rank.getRankByKills(kills);
                    if (rank != null) {
                        dataManager.setPlayerRank(uuid, rank);
                        plugin.getNameColorManager().updatePlayerNameColor(player, rank);
                    }
                    
                    player.sendMessage("§a═══════════════════════════");
                    player.sendMessage("§aВы зарегистрированы в Гильдии Путешественников!");
                    if (rank != null) {
                        player.sendMessage("§eВаш ранг: " + rank.getDisplayName());
                    }
                    player.sendMessage("§a═══════════════════════════");
                    player.closeInventory();
                } else if (clicked.getType() == Material.ANVIL && clicked.getItemMeta().getDisplayName().contains("Повысить")) {
                    // Повышение ранга
                    Rank currentRank = dataManager.getPlayerRank(uuid);
                    if (currentRank != null) {
                        Rank nextRank = getNextRank(currentRank);
                        if (nextRank != null) {
                            int kills = dataManager.getMonsterKills(uuid);
                            if (kills >= nextRank.getRequiredKills()) {
                                dataManager.setPlayerRank(uuid, nextRank);
                                plugin.getNameColorManager().updatePlayerNameColor(player, nextRank);
                                
                                player.sendMessage("§6═══════════════════════════");
                                player.sendMessage("§6§lПОВЫШЕНИЕ РАНГА!");
                                player.sendMessage("§eВаш новый ранг: " + nextRank.getDisplayName());
                                player.sendMessage("§6═══════════════════════════");
                                
                                // Если достигли ранга S или SS, показываем объявление
                                if (nextRank == Rank.S || nextRank == Rank.SS) {
                                    plugin.getAnnouncementManager().showRankAnnouncement(player, nextRank);
                                }
                                
                                // Для ранга SS - салют и подарки
                                if (nextRank == Rank.SS) {
                                    plugin.getAnnouncementManager().celebrateSSRank(player);
                                }
                                
                                player.closeInventory();
                                showMainMenu(player);
                            }
                        }
                    }
                } else if (clicked.getType() == Material.WHITE_BANNER) {
                    // Управление отрядом
                    player.closeInventory();
                    showSquadMenu(player);
                }
            } else if (title.equals("§6§lУправление Отрядом")) {
                // Меню отряда
                if (clicked.getType() == Material.EMERALD_BLOCK && clicked.getItemMeta().getDisplayName().contains("Создать")) {
                    // Проверяем монеты
                    if (!coinManager.hasCoins(uuid, 1000.0)) {
                        double coins = coinManager.getCoins(uuid);
                        player.sendMessage("§cНедостаточно монет для создания отряда!");
                        player.sendMessage("§7Требуется: §e1000 монет");
                        player.sendMessage("§7У вас: §e" + String.format("%.0f", coins) + " монет");
                        player.closeInventory();
                        return;
                    }
                    
                    player.closeInventory();
                    player.sendMessage("§aВведите название отряда в чат:");
                    player.sendMessage("§7Стоимость создания: §e1000 монет");
                    playerStates.put(uuid, MenuState.WAITING_SQUAD_NAME);
                } else if (clicked.getType() == Material.DIAMOND_BLOCK && clicked.getItemMeta().getDisplayName().contains("Вступить")) {
                    player.closeInventory();
                    player.sendMessage("§aВведите название отряда, в который хотите вступить:");
                    playerStates.put(uuid, MenuState.WAITING_SQUAD_JOIN_NAME);
                } else if (clicked.getType() == Material.TNT && clicked.getItemMeta().getDisplayName().contains("Роспустить")) {
                    String squadName = dataManager.getPlayerSquad(uuid);
                    if (squadName != null) {
                        UUID leaderUuid = dataManager.getSquadLeader(squadName);
                        if (leaderUuid != null && leaderUuid.equals(uuid)) {
                            // Уведомляем всех участников
                            Set<UUID> members = dataManager.getSquadMembers(squadName);
                            for (UUID memberUuid : members) {
                                Player member = Bukkit.getPlayer(memberUuid);
                                if (member != null) {
                                    member.sendMessage("§cОтряд §e" + squadName + " §cбыл распущен лидером!");
                                }
                            }
                            
                            dataManager.disbandSquad(squadName, uuid);
                            player.sendMessage("§aОтряд §e" + squadName + " §aраспущен!");
                            player.closeInventory();
                        } else {
                            player.sendMessage("§cТолько лидер может распустить отряд!");
                        }
                    }
                } else if (clicked.getType() == Material.REDSTONE_BLOCK && clicked.getItemMeta().getDisplayName().contains("Покинуть")) {
                    String squadName = dataManager.getPlayerSquad(uuid);
                    if (squadName != null) {
                        UUID leaderUuid = dataManager.getSquadLeader(squadName);
                        if (leaderUuid != null && leaderUuid.equals(uuid)) {
                            player.sendMessage("§cВы не можете покинуть отряд, так как вы лидер!");
                            player.sendMessage("§7Используйте кнопку 'Роспустить Отряд' для роспуска отряда.");
                            player.closeInventory();
                            return;
                        }
                        
                        dataManager.leaveSquad(uuid);
                        player.sendMessage("§aВы покинули отряд: §e" + squadName);
                        player.closeInventory();
                    }
                }
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
        
        MenuState state = playerStates.get(uuid);
        
        if (state == MenuState.WAITING_SQUAD_NAME) {
            // Создание отряда
            if (message.length() < 3 || message.length() > 16) {
                player.sendMessage("§cНазвание отряда должно быть от 3 до 16 символов!");
                playerStates.remove(uuid);
                return;
            }
            
            // Проверяем монеты еще раз
            if (!coinManager.hasCoins(uuid, 1000.0)) {
                double coins = coinManager.getCoins(uuid);
                player.sendMessage("§cНедостаточно монет для создания отряда!");
                player.sendMessage("§7Требуется: §e1000 монет");
                player.sendMessage("§7У вас: §e" + String.format("%.0f", coins) + " монет");
                playerStates.remove(uuid);
                return;
            }
            
            if (dataManager.createSquad(message, uuid)) {
                // Списываем монеты
                if (coinManager.removeCoins(uuid, 1000.0)) {
                    player.sendMessage("§a═══════════════════════════");
                    player.sendMessage("§aОтряд §e" + message + " §aсоздан!");
                    player.sendMessage("§7С вашего счета списано: §e1000 монет");
                    player.sendMessage("§a═══════════════════════════");
                } else {
                    player.sendMessage("§cОшибка при списании монет!");
                    dataManager.leaveSquad(uuid); // Откатываем создание отряда
                }
            } else {
                player.sendMessage("§cОтряд с таким названием уже существует!");
            }
            playerStates.remove(uuid);
        } else if (state == MenuState.WAITING_SQUAD_JOIN_NAME) {
            // Вступление в отряд
            if (dataManager.joinSquad(message, uuid)) {
                player.sendMessage("§aВы вступили в отряд: §e" + message);
            } else {
                player.sendMessage("§cОтряд не найден!");
            }
            playerStates.remove(uuid);
        }
    }
}

