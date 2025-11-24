package com.travelersguild.menu;

import com.travelersguild.TravelersGuild;
import com.travelersguild.data.GuildDataManager;
import com.travelersguild.data.Rank;
import com.travelersguild.data.SquadRank;
import com.travelersguild.economy.CoinManager;
import org.bukkit.Bukkit;
import org.bukkit.ChatColor;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryCloseEvent;
import org.bukkit.event.inventory.InventoryType;
import org.bukkit.event.inventory.ClickType;
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
        WAITING_SQUAD_JOIN_NAME,
        WAITING_SQUAD_EDIT_NAME,
        WAITING_TREASURY_DEPOSIT,
        WAITING_TREASURY_WITHDRAW,
        WAITING_JOIN_FEE,
        WAITING_JOIN_REQUEST_SQUAD
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
            // Игрок состоит в отряде
            UUID leaderUuid = dataManager.getSquadLeader(currentSquad);
            boolean isLeader = leaderUuid != null && leaderUuid.equals(uuid);
            SquadRank squadRank = dataManager.getSquadRank(currentSquad);
            
            // Информация об отряде
            ItemStack infoItem = new ItemStack(Material.BOOK);
            ItemMeta infoMeta = infoItem.getItemMeta();
            infoMeta.setDisplayName("§6Отряд: " + squadRank.getColorCode() + currentSquad);
            List<String> infoLore = new ArrayList<>();
            infoLore.add("§7Ранг: " + squadRank.getDisplayName());
            Set<UUID> members = dataManager.getSquadMembers(currentSquad);
            infoLore.add("§7Участников: §e" + members.size() + "/" + squadRank.getMaxMembers());
            if (isLeader) {
                infoLore.add("");
                infoLore.add("§6Вы - лидер отряда");
                infoLore.add("§aНажмите для управления");
            }
            infoMeta.setLore(infoLore);
            infoItem.setItemMeta(infoMeta);
            inv.setItem(4, infoItem);
            
            if (isLeader) {
                // Управление отрядом (для лидера)
                ItemStack manageButton = new ItemStack(Material.COMMAND_BLOCK);
                ItemMeta manageMeta = manageButton.getItemMeta();
                manageMeta.setDisplayName("§bУправление Отрядом");
                manageMeta.setLore(Arrays.asList(
                    "§7Нажмите, чтобы открыть",
                    "§7меню управления отрядом"
                ));
                manageButton.setItemMeta(manageMeta);
                inv.setItem(13, manageButton);
            } else {
                // Покинуть отряд (для обычных участников)
                ItemStack leaveButton = new ItemStack(Material.REDSTONE_BLOCK);
                ItemMeta leaveMeta = leaveButton.getItemMeta();
                leaveMeta.setDisplayName("§cПокинуть Отряд");
                leaveMeta.setLore(Arrays.asList(
                    "§7Нажмите, чтобы",
                    "§7покинуть отряд: §e" + currentSquad
                ));
                leaveButton.setItemMeta(leaveMeta);
                inv.setItem(13, leaveButton);
            }
        }
        
        player.openInventory(inv);
    }
    
    public void showSquadListMenu(Player player) {
        Set<String> squads = dataManager.getAllSquads();
        
        if (squads.isEmpty()) {
            player.sendMessage("§cНет доступных отрядов для вступления!");
            return;
        }
        
        int size = Math.max(9, ((squads.size() + 8) / 9) * 9);
        if (size > 54) size = 54;
        
        Inventory inv = Bukkit.createInventory(null, size, "§6§lСписок Отрядов");
        
        int slot = 0;
        for (String squadName : squads) {
            SquadRank squadRank = dataManager.getSquadRank(squadName);
            Set<UUID> members = dataManager.getSquadMembers(squadName);
            double joinFee = dataManager.getSquadJoinFee(squadName);
            
            // Проверяем, не заполнен ли отряд
            if (members.size() >= squadRank.getMaxMembers()) {
                continue; // Пропускаем заполненные отряды
            }
            
            Material material = Material.PAPER;
            if (squadRank == SquadRank.RANK_3) material = Material.GOLD_INGOT;
            else if (squadRank == SquadRank.RANK_2) material = Material.AMETHYST_SHARD;
            else if (squadRank == SquadRank.RANK_1) material = Material.LAPIS_LAZULI;
            
            ItemStack squadItem = new ItemStack(material);
            ItemMeta meta = squadItem.getItemMeta();
            meta.setDisplayName(squadRank.getColorCode() + squadName);
            
            List<String> lore = new ArrayList<>();
            lore.add("§7Ранг: " + squadRank.getDisplayName());
            lore.add("§7Участников: §e" + members.size() + "/" + squadRank.getMaxMembers());
            if (joinFee > 0) {
                lore.add("§7Сбор при вступлении: §e" + String.format("%.0f", joinFee) + " монет");
            } else {
                lore.add("§7Сбор при вступлении: §aБесплатно");
            }
            lore.add("");
            lore.add("§aЛКМ - подать запрос на вступление");
            
            meta.setLore(lore);
            squadItem.setItemMeta(meta);
            
            if (slot < size) {
                inv.setItem(slot, squadItem);
                slot++;
            }
        }
        
        if (slot == 0) {
            player.sendMessage("§cНет доступных отрядов для вступления (все заполнены)!");
            return;
        }
        
        player.openInventory(inv);
    }
    
    public void showSquadManagementMenu(Player player) {
        UUID uuid = player.getUniqueId();
        String squadName = dataManager.getPlayerSquad(uuid);
        
        if (squadName == null || !dataManager.isSquadLeader(squadName, uuid)) {
            player.sendMessage("§cТолько лидер отряда может управлять отрядом!");
            return;
        }
        
        SquadRank squadRank = dataManager.getSquadRank(squadName);
        double treasury = dataManager.getSquadTreasury(squadName);
        double joinFee = dataManager.getSquadJoinFee(squadName);
        Set<UUID> members = dataManager.getSquadMembers(squadName);
        Set<UUID> joinRequests = dataManager.getJoinRequests(squadName);
        
        Inventory inv = Bukkit.createInventory(null, 54, "§6§lУправление Отрядом: " + squadName);
        
        // Информация об отряде
        ItemStack infoItem = new ItemStack(Material.BOOK);
        ItemMeta infoMeta = infoItem.getItemMeta();
        infoMeta.setDisplayName("§6Информация об Отряде");
        List<String> infoLore = new ArrayList<>();
        infoLore.add("§7Название: §e" + squadName);
        infoLore.add("§7Ранг: " + squadRank.getDisplayName());
        infoLore.add("§7Участников: §e" + members.size() + "/" + squadRank.getMaxMembers());
        infoLore.add("§7Казна: §e" + String.format("%.0f", treasury) + " монет");
        infoLore.add("§7Сбор при вступлении: §e" + String.format("%.0f", joinFee) + " монет");
        infoMeta.setLore(infoLore);
        infoItem.setItemMeta(infoMeta);
        inv.setItem(4, infoItem);
        
        // Редактировать название
        ItemStack editNameItem = new ItemStack(Material.ANVIL);
        ItemMeta editNameMeta = editNameItem.getItemMeta();
        editNameMeta.setDisplayName("§aРедактировать Название");
        editNameMeta.setLore(Arrays.asList("§7Нажмите, чтобы изменить название отряда"));
        editNameItem.setItemMeta(editNameMeta);
        inv.setItem(10, editNameItem);
        
        // Казна - пополнить
        ItemStack treasuryDepositItem = new ItemStack(Material.EMERALD);
        ItemMeta treasuryDepositMeta = treasuryDepositItem.getItemMeta();
        treasuryDepositMeta.setDisplayName("§aПополнить Казну");
        treasuryDepositMeta.setLore(Arrays.asList(
            "§7Текущая казна: §e" + String.format("%.0f", treasury) + " монет",
            "§7Нажмите, чтобы пополнить казну"
        ));
        treasuryDepositItem.setItemMeta(treasuryDepositMeta);
        inv.setItem(12, treasuryDepositItem);
        
        // Казна - снять
        ItemStack treasuryWithdrawItem = new ItemStack(Material.GOLD_INGOT);
        ItemMeta treasuryWithdrawMeta = treasuryWithdrawItem.getItemMeta();
        treasuryWithdrawMeta.setDisplayName("§6Снять из Казны");
        treasuryWithdrawMeta.setLore(Arrays.asList(
            "§7Текущая казна: §e" + String.format("%.0f", treasury) + " монет",
            "§7Нажмите, чтобы снять монеты из казны"
        ));
        treasuryWithdrawItem.setItemMeta(treasuryWithdrawMeta);
        inv.setItem(14, treasuryWithdrawItem);
        
        // Повысить ранг отряда
        SquadRank nextRank = squadRank.getNextRank();
        if (nextRank != null) {
            ItemStack upgradeItem = new ItemStack(Material.DIAMOND);
            ItemMeta upgradeMeta = upgradeItem.getItemMeta();
            upgradeMeta.setDisplayName("§bПовысить Ранг Отряда");
            upgradeMeta.setLore(Arrays.asList(
                "§7Текущий ранг: " + squadRank.getDisplayName(),
                "§7Следующий ранг: " + nextRank.getDisplayName(),
                "§7Стоимость: §e" + String.format("%.0f", nextRank.getUpgradeCost()) + " монет",
                "§7Новый лимит участников: §e" + nextRank.getMaxMembers()
            ));
            upgradeItem.setItemMeta(upgradeMeta);
            inv.setItem(16, upgradeItem);
        }
        
        // Установить сбор при вступлении
        ItemStack joinFeeItem = new ItemStack(Material.GOLD_NUGGET);
        ItemMeta joinFeeMeta = joinFeeItem.getItemMeta();
        joinFeeMeta.setDisplayName("§eУстановить Сбор при Вступлении");
        joinFeeMeta.setLore(Arrays.asList(
            "§7Текущий сбор: §e" + String.format("%.0f", joinFee) + " монет",
            "§7Нажмите, чтобы изменить"
        ));
        joinFeeItem.setItemMeta(joinFeeMeta);
        inv.setItem(28, joinFeeItem);
        
        // Запросы на вступление
        ItemStack requestsItem = new ItemStack(Material.PAPER);
        ItemMeta requestsMeta = requestsItem.getItemMeta();
        requestsMeta.setDisplayName("§bЗапросы на Вступление");
        List<String> requestsLore = new ArrayList<>();
        requestsLore.add("§7Запросов: §e" + joinRequests.size());
        if (!joinRequests.isEmpty()) {
            requestsLore.add("");
            int count = 0;
            for (UUID requesterUuid : joinRequests) {
                if (count >= 5) {
                    requestsLore.add("§7... и еще " + (joinRequests.size() - count));
                    break;
                }
                Player requester = Bukkit.getPlayer(requesterUuid);
                String name = requester != null ? requester.getName() : Bukkit.getOfflinePlayer(requesterUuid).getName();
                requestsLore.add("§7- §e" + name);
                count++;
            }
        }
        requestsLore.add("");
        requestsLore.add("§aНажмите, чтобы просмотреть");
        requestsMeta.setLore(requestsLore);
        requestsItem.setItemMeta(requestsMeta);
        inv.setItem(30, requestsItem);
        
        // Роспустить отряд
        ItemStack disbandItem = new ItemStack(Material.TNT);
        ItemMeta disbandMeta = disbandItem.getItemMeta();
        disbandMeta.setDisplayName("§c§lРоспустить Отряд");
        disbandMeta.setLore(Arrays.asList(
            "§cВнимание: это действие нельзя отменить!",
            "§cВсе участники будут исключены из отряда"
        ));
        disbandItem.setItemMeta(disbandMeta);
        inv.setItem(49, disbandItem);
        
        player.openInventory(inv);
    }
    
    @EventHandler
    public void onInventoryClick(InventoryClickEvent event) {
        if (!(event.getWhoClicked() instanceof Player)) {
            return;
        }
        
        Player player = (Player) event.getWhoClicked();
        String title = event.getView().getTitle();
        
        // Проверяем, что это наше меню
        if (!title.equals("§6§lГильдия Путешественников") && 
            !title.equals("§6§lУправление Отрядом") &&
            !title.startsWith("§6§lСписок Отрядов") &&
            !title.startsWith("§6§lУправление Отрядом:") &&
            !title.equals("§6§lЗапросы на Вступление")) {
            return; // Не наше меню, не обрабатываем
        }
        
        // Проверяем, что клик в верхнем инвентаре (GUI), а не в инвентаре игрока
        if (event.getClickedInventory() == null) {
            return;
        }
        
        // Если клик в инвентаре игрока (нижний инвентарь), не обрабатываем
        if (event.getClickedInventory().getType() == InventoryType.PLAYER) {
            return;
        }
        
        // Если клик не в верхнем инвентаре (GUI), не обрабатываем
        if (event.getClickedInventory() != event.getView().getTopInventory()) {
            return;
        }
        
        // Отменяем событие для нашего GUI
        event.setCancelled(true);
        
        // Предотвращаем перетаскивание - проверяем, что курсор пуст и это не перетаскивание
        if (event.getCursor() != null && event.getCursor().getType() != Material.AIR) {
            return;
        }
        
        // Предотвращаем перетаскивание через проверку типа клика
        ClickType clickType = event.getClick();
        if (clickType == ClickType.SHIFT_LEFT || clickType == ClickType.SHIFT_RIGHT ||
            clickType == ClickType.NUMBER_KEY || clickType == ClickType.SWAP_OFFHAND ||
            clickType == ClickType.DOUBLE_CLICK) {
            return;
        }
        
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
                        plugin.getNameColorManager().updatePlayerNameColor(player, rank, true);
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
                                plugin.getNameColorManager().updatePlayerNameColor(player, nextRank, true);
                                
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
                    showSquadListMenu(player);
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
                            player.sendMessage("§7Используйте меню управления для роспуска отряда.");
                            player.closeInventory();
                            return;
                        }
                        
                        dataManager.leaveSquad(uuid);
                        plugin.getNameColorManager().updatePlayerNameColor(player, dataManager.getPlayerRank(uuid), true);
                        player.sendMessage("§aВы покинули отряд: §e" + squadName);
                        player.closeInventory();
                    }
                } else if (clicked.getType() == Material.COMMAND_BLOCK && clicked.getItemMeta().getDisplayName().contains("Управление")) {
                    player.closeInventory();
                    showSquadManagementMenu(player);
                }
            } else if (title.startsWith("§6§lСписок Отрядов")) {
                // Обработка клика по отряду в списке
                event.setCancelled(true);
                if (clicked == null || clicked.getType() == Material.AIR) {
                    return;
                }
                
                String displayName = clicked.getItemMeta().getDisplayName();
                String squadName = ChatColor.stripColor(displayName);
                player.closeInventory();
                
                // Проверяем, не состоит ли уже игрок в отряде
                if (dataManager.getPlayerSquad(uuid) != null) {
                    player.sendMessage("§cВы уже состоите в отряде!");
                    return;
                }
                
                // Проверяем, не подал ли уже запрос
                Set<UUID> requests = dataManager.getJoinRequests(squadName);
                if (requests.contains(uuid)) {
                    player.sendMessage("§cВы уже подали запрос на вступление в этот отряд!");
                    return;
                }
                
                // Подаем запрос на вступление
                double joinFee = dataManager.getSquadJoinFee(squadName);
                if (joinFee > 0 && !coinManager.hasCoins(uuid, joinFee)) {
                    player.sendMessage("§cНедостаточно монет для вступления!");
                    player.sendMessage("§7Требуется: §e" + String.format("%.0f", joinFee) + " монет");
                    return;
                }
                
                if (dataManager.addJoinRequest(squadName, uuid)) {
                    player.sendMessage("§aЗапрос на вступление в отряд §e" + squadName + " §aотправлен!");
                    
                    // Уведомляем лидера
                    UUID leaderUuid = dataManager.getSquadLeader(squadName);
                    if (leaderUuid != null) {
                        Player leader = Bukkit.getPlayer(leaderUuid);
                        if (leader != null) {
                            leader.sendMessage("§bНовый запрос на вступление от: §e" + player.getName());
                        }
                    }
                } else {
                    player.sendMessage("§cНе удалось отправить запрос!");
                }
            } else if (title.equals("§6§lЗапросы на Вступление")) {
                // Обработка запросов на вступление
                String squadName = dataManager.getPlayerSquad(uuid);
                if (squadName == null || !dataManager.isSquadLeader(squadName, uuid)) {
                    player.sendMessage("§cОшибка: вы не являетесь лидером отряда!");
                    player.closeInventory();
                    return;
                }
                
                if (clicked == null || clicked.getType() == Material.AIR) {
                    return;
                }
                
                // Обработка кнопки "Назад"
                if (clicked.getType() == Material.ARROW && clicked.getItemMeta().getDisplayName().contains("Назад")) {
                    player.closeInventory();
                    showSquadManagementMenu(player);
                    return;
                }
                
                String displayName = clicked.getItemMeta().getDisplayName();
                
                // Обработка кнопки "Принять"
                if (clicked.getType() == Material.EMERALD_BLOCK && displayName.contains("Принять")) {
                    // Извлекаем имя игрока из названия кнопки
                    String requesterName = displayName.substring(displayName.indexOf(": §e") + 4);
                    UUID requesterUuid = null;
                    
                    // Находим UUID по имени
                    for (UUID reqUuid : dataManager.getJoinRequests(squadName)) {
                        Player reqPlayer = Bukkit.getPlayer(reqUuid);
                        String name = reqPlayer != null ? reqPlayer.getName() : Bukkit.getOfflinePlayer(reqUuid).getName();
                        if (name.equals(requesterName)) {
                            requesterUuid = reqUuid;
                            break;
                        }
                    }
                    
                    if (requesterUuid == null) {
                        player.sendMessage("§cИгрок не найден!");
                        return;
                    }
                    
                    // Принять запрос
                    SquadRank squadRank = dataManager.getSquadRank(squadName);
                    Set<UUID> members = dataManager.getSquadMembers(squadName);
                    
                    if (members.size() >= squadRank.getMaxMembers()) {
                        player.sendMessage("§cОтряд заполнен! Максимум участников: " + squadRank.getMaxMembers());
                        return;
                    }
                    
                    // Проверяем и списываем сбор
                    double joinFee = dataManager.getSquadJoinFee(squadName);
                    if (joinFee > 0) {
                        if (!coinManager.hasCoins(requesterUuid, joinFee)) {
                            player.sendMessage("§cУ игрока недостаточно монет для вступления!");
                            Player requester = Bukkit.getPlayer(requesterUuid);
                            if (requester != null) {
                                requester.sendMessage("§cУ вас недостаточно монет для вступления в отряд!");
                            }
                            dataManager.removeJoinRequest(squadName, requesterUuid);
                            player.closeInventory();
                            showJoinRequestsMenu(player, squadName);
                            return;
                        }
                        
                        if (coinManager.removeCoins(requesterUuid, joinFee)) {
                            dataManager.addToSquadTreasury(squadName, uuid, joinFee);
                        }
                    }
                    
                    // Принимаем в отряд
                    if (dataManager.joinSquad(squadName, requesterUuid)) {
                        dataManager.removeJoinRequest(squadName, requesterUuid);
                        plugin.getNameColorManager().updateSquadDisplay(squadName);
                        
                        player.sendMessage("§aИгрок §e" + requesterName + " §aпринят в отряд!");
                        Player requester = Bukkit.getPlayer(requesterUuid);
                        if (requester != null) {
                            requester.sendMessage("§a═══════════════════════════");
                            requester.sendMessage("§aВы приняты в отряд: §e" + squadName);
                            requester.sendMessage("§a═══════════════════════════");
                            plugin.getNameColorManager().updatePlayerNameColor(requester, dataManager.getPlayerRank(requesterUuid), true);
                        }
                        
                        // Закрываем инвентарь сразу и открываем новое меню в следующем тике
                        player.closeInventory();
                        plugin.getServer().getScheduler().runTask(plugin, () -> {
                            if (player.isOnline() && !player.isDead()) {
                                showJoinRequestsMenu(player, squadName);
                            }
                        });
                    }
                } else if (clicked.getType() == Material.REDSTONE_BLOCK && displayName.contains("Отклонить")) {
                    // Обработка кнопки "Отклонить"
                    // Извлекаем имя игрока из названия кнопки
                    String requesterName = displayName.substring(displayName.indexOf(": §e") + 4);
                    UUID requesterUuid = null;
                    
                    // Находим UUID по имени
                    for (UUID reqUuid : dataManager.getJoinRequests(squadName)) {
                        Player reqPlayer = Bukkit.getPlayer(reqUuid);
                        String name = reqPlayer != null ? reqPlayer.getName() : Bukkit.getOfflinePlayer(reqUuid).getName();
                        if (name.equals(requesterName)) {
                            requesterUuid = reqUuid;
                            break;
                        }
                    }
                    
                    if (requesterUuid == null) {
                        player.sendMessage("§cИгрок не найден!");
                        return;
                    }
                    
                    // Отклонить запрос
                    dataManager.removeJoinRequest(squadName, requesterUuid);
                    player.sendMessage("§cЗапрос от §e" + requesterName + " §cотклонен");
                    
                    Player requester = Bukkit.getPlayer(requesterUuid);
                    if (requester != null) {
                        requester.sendMessage("§cВаш запрос на вступление в отряд §e" + squadName + " §cотклонен");
                    }
                    
                    // Закрываем инвентарь сразу и открываем новое меню в следующем тике
                    player.closeInventory();
                    plugin.getServer().getScheduler().runTask(plugin, () -> {
                        if (player.isOnline() && !player.isDead()) {
                            showJoinRequestsMenu(player, squadName);
                        }
                    });
                }
            } else if (title.startsWith("§6§lУправление Отрядом:")) {
                // Меню управления отрядом для лидера
                event.setCancelled(true);
                String squadName = dataManager.getPlayerSquad(uuid);
                if (squadName == null || !dataManager.isSquadLeader(squadName, uuid)) {
                    player.sendMessage("§cОшибка: вы не являетесь лидером отряда!");
                    player.closeInventory();
                    return;
                }
                
                String displayName = clicked.getItemMeta().getDisplayName();
                
                if (clicked.getType() == Material.ANVIL && displayName.contains("Редактировать")) {
                    player.closeInventory();
                    player.sendMessage("§aВведите новое название отряда:");
                    playerStates.put(uuid, MenuState.WAITING_SQUAD_EDIT_NAME);
                } else if (clicked.getType() == Material.EMERALD && displayName.contains("Пополнить")) {
                    player.closeInventory();
                    player.sendMessage("§aВведите сумму для пополнения казны:");
                    playerStates.put(uuid, MenuState.WAITING_TREASURY_DEPOSIT);
                } else if (clicked.getType() == Material.GOLD_INGOT && displayName.contains("Снять")) {
                    player.closeInventory();
                    player.sendMessage("§aВведите сумму для снятия из казны:");
                    playerStates.put(uuid, MenuState.WAITING_TREASURY_WITHDRAW);
                } else if (clicked.getType() == Material.DIAMOND && displayName.contains("Повысить")) {
                    SquadRank currentRank = dataManager.getSquadRank(squadName);
                    SquadRank nextRank = currentRank.getNextRank();
                    if (nextRank == null) {
                        player.sendMessage("§cОтряд уже имеет максимальный ранг!");
                        return;
                    }
                    
                    double treasury = dataManager.getSquadTreasury(squadName);
                    if (treasury < nextRank.getUpgradeCost()) {
                        player.sendMessage("§cНедостаточно средств в казне отряда!");
                        player.sendMessage("§7Требуется: §e" + String.format("%.0f", nextRank.getUpgradeCost()) + " монет");
                        player.sendMessage("§7В казне: §e" + String.format("%.0f", treasury) + " монет");
                        return;
                    }
                    
                    if (dataManager.removeFromSquadTreasury(squadName, uuid, nextRank.getUpgradeCost())) {
                        if (dataManager.upgradeSquadRank(squadName, uuid)) {
                            plugin.getNameColorManager().updateSquadDisplay(squadName);
                            player.sendMessage("§6═══════════════════════════");
                            player.sendMessage("§6§lРАНГ ОТРЯДА ПОВЫШЕН!");
                            player.sendMessage("§eНовый ранг: " + nextRank.getDisplayName());
                            player.sendMessage("§7Новый лимит участников: §e" + nextRank.getMaxMembers());
                            player.sendMessage("§6═══════════════════════════");
                            player.closeInventory();
                            showSquadManagementMenu(player);
                        } else {
                            // Откатываем списание, если повышение не удалось
                            dataManager.addToSquadTreasury(squadName, uuid, nextRank.getUpgradeCost());
                            player.sendMessage("§cОшибка при повышении ранга отряда!");
                        }
                    }
                } else if (clicked.getType() == Material.GOLD_NUGGET && displayName.contains("Сбор")) {
                    player.closeInventory();
                    player.sendMessage("§aВведите новый сбор при вступлении (0 для бесплатного вступления):");
                    playerStates.put(uuid, MenuState.WAITING_JOIN_FEE);
                } else if (clicked.getType() == Material.PAPER && displayName.contains("Запросы")) {
                    player.closeInventory();
                    showJoinRequestsMenu(player, squadName);
                } else if (clicked.getType() == Material.TNT && displayName.contains("Роспустить")) {
                    // Роспуск отряда
                    Set<UUID> members = dataManager.getSquadMembers(squadName);
                    for (UUID memberUuid : members) {
                        Player member = Bukkit.getPlayer(memberUuid);
                        if (member != null) {
                            member.sendMessage("§cОтряд §e" + squadName + " §cбыл распущен лидером!");
                            plugin.getNameColorManager().updatePlayerNameColor(member, dataManager.getPlayerRank(memberUuid), true);
                        }
                    }
                    
                    dataManager.disbandSquad(squadName, uuid);
                    plugin.getNameColorManager().updatePlayerNameColor(player, dataManager.getPlayerRank(uuid), true);
                    player.sendMessage("§aОтряд §e" + squadName + " §aраспущен!");
                    player.closeInventory();
                }
            }
        }
    }
    
    public void showJoinRequestsMenu(Player player, String squadName) {
        UUID uuid = player.getUniqueId();
        if (!dataManager.isSquadLeader(squadName, uuid)) {
            player.sendMessage("§cТолько лидер может просматривать запросы!");
            return;
        }
        
        Set<UUID> requests = dataManager.getJoinRequests(squadName);
        
        if (requests.isEmpty()) {
            player.sendMessage("§7Нет запросов на вступление в отряд");
            return;
        }
        
        // Размер меню: для каждого запроса нужно 2 слота (принять/отклонить) + кнопка назад
        int itemsPerRow = 9;
        int rows = (int) Math.ceil((requests.size() * 2 + 1) / (double) itemsPerRow);
        int size = Math.max(9, Math.min(54, rows * 9));
        
        Inventory inv = Bukkit.createInventory(null, size, "§6§lЗапросы на Вступление");
        
        int slot = 0;
        double joinFee = dataManager.getSquadJoinFee(squadName);
        
        for (UUID requesterUuid : requests) {
            Player requester = Bukkit.getPlayer(requesterUuid);
            String requesterName = requester != null ? requester.getName() : Bukkit.getOfflinePlayer(requesterUuid).getName();
            Rank requesterRank = dataManager.getPlayerRank(requesterUuid);
            
            // Кнопка "Принять"
            ItemStack acceptItem = new ItemStack(Material.EMERALD_BLOCK);
            ItemMeta acceptMeta = acceptItem.getItemMeta();
            acceptMeta.setDisplayName("§a§lПринять: §e" + requesterName);
            List<String> acceptLore = new ArrayList<>();
            acceptLore.add("§7Нажмите, чтобы принять");
            acceptLore.add("§7игрока в отряд");
            acceptLore.add("");
            if (requesterRank != null) {
                acceptLore.add("§7Ранг: " + requesterRank.getDisplayName());
            }
            if (joinFee > 0) {
                acceptLore.add("§7Сбор: §e" + String.format("%.0f", joinFee) + " монет");
            }
            acceptMeta.setLore(acceptLore);
            acceptItem.setItemMeta(acceptMeta);
            
            // Кнопка "Отклонить"
            ItemStack rejectItem = new ItemStack(Material.REDSTONE_BLOCK);
            ItemMeta rejectMeta = rejectItem.getItemMeta();
            rejectMeta.setDisplayName("§c§lОтклонить: §e" + requesterName);
            List<String> rejectLore = new ArrayList<>();
            rejectLore.add("§7Нажмите, чтобы");
            rejectLore.add("§7отклонить запрос");
            rejectMeta.setLore(rejectLore);
            rejectItem.setItemMeta(rejectMeta);
            
            // Размещаем кнопки рядом друг с другом
            if (slot < size - 1) {
                inv.setItem(slot, acceptItem);
                slot++;
            }
            if (slot < size - 1) {
                inv.setItem(slot, rejectItem);
                slot++;
            }
        }
        
        // Кнопка "Назад" в последнем слоте
        ItemStack backItem = new ItemStack(Material.ARROW);
        ItemMeta backMeta = backItem.getItemMeta();
        backMeta.setDisplayName("§7Назад");
        backMeta.setLore(Arrays.asList("§7Вернуться в меню управления"));
        backItem.setItemMeta(backMeta);
        inv.setItem(size - 1, backItem);
        
        player.openInventory(inv);
    }
    
    @EventHandler
    public void onInventoryClose(InventoryCloseEvent event) {
        if (!(event.getPlayer() instanceof Player)) {
            return;
        }
        
        Player player = (Player) event.getPlayer();
        String title = event.getView().getTitle();
        
        // Если закрыто наше меню, убеждаемся, что игрок может нормально взаимодействовать
        if (title.equals("§6§lГильдия Путешественников") || 
            title.equals("§6§lУправление Отрядом") ||
            title.startsWith("§6§lСписок Отрядов") ||
            title.startsWith("§6§lУправление Отрядом:") ||
            title.equals("§6§lЗапросы на Вступление")) {
            
            // Убеждаемся, что игрок может взаимодействовать с миром
            // Это должно помочь, если что-то блокировало действия игрока
            plugin.getServer().getScheduler().runTask(plugin, () -> {
                if (player.isOnline() && !player.isDead()) {
                    // Сбрасываем любые возможные блокировки
                    player.updateInventory();
                }
            });
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
                    plugin.getNameColorManager().updatePlayerNameColor(player, dataManager.getPlayerRank(uuid), true);
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
            // Подача запроса на вступление в отряд
            if (!dataManager.getAllSquads().contains(message)) {
                player.sendMessage("§cОтряд не найден!");
                playerStates.remove(uuid);
                return;
            }
            
            // Проверяем сбор при вступлении
            double joinFee = dataManager.getSquadJoinFee(message);
            if (joinFee > 0 && !coinManager.hasCoins(uuid, joinFee)) {
                player.sendMessage("§cНедостаточно монет для вступления в отряд!");
                player.sendMessage("§7Требуется: §e" + String.format("%.0f", joinFee) + " монет");
                playerStates.remove(uuid);
                return;
            }
            
            // Подаем запрос на вступление
            if (dataManager.addJoinRequest(message, uuid)) {
                player.sendMessage("§aЗапрос на вступление в отряд §e" + message + " §aотправлен!");
                player.sendMessage("§7Ожидайте одобрения от лидера отряда.");
                
                // Уведомляем лидера
                UUID leaderUuid = dataManager.getSquadLeader(message);
                if (leaderUuid != null) {
                    Player leader = Bukkit.getPlayer(leaderUuid);
                    if (leader != null) {
                        leader.sendMessage("§bНовый запрос на вступление от: §e" + player.getName());
                    }
                }
            } else {
                player.sendMessage("§cНе удалось отправить запрос! Возможно, вы уже подали запрос или состоите в отряде.");
            }
            playerStates.remove(uuid);
        } else if (state == MenuState.WAITING_SQUAD_EDIT_NAME) {
            // Редактирование названия отряда
            String currentSquad = dataManager.getPlayerSquad(uuid);
            if (currentSquad == null || !dataManager.isSquadLeader(currentSquad, uuid)) {
                player.sendMessage("§cОшибка: вы не являетесь лидером отряда!");
                playerStates.remove(uuid);
                return;
            }
            
            if (message.length() < 3 || message.length() > 16) {
                player.sendMessage("§cНазвание отряда должно быть от 3 до 16 символов!");
                playerStates.remove(uuid);
                return;
            }
            
            if (dataManager.getAllSquads().contains(message) && !message.equals(currentSquad)) {
                player.sendMessage("§cОтряд с таким названием уже существует!");
                playerStates.remove(uuid);
                return;
            }
            
            // Переименовываем отряд (это требует дополнительной реализации)
            player.sendMessage("§aНазвание отряда изменено на: §e" + message);
            // TODO: Реализовать переименование отряда
            playerStates.remove(uuid);
        } else if (state == MenuState.WAITING_TREASURY_DEPOSIT) {
            // Пополнение казны
            try {
                double amount = Double.parseDouble(message);
                if (amount <= 0) {
                    player.sendMessage("§cСумма должна быть больше 0!");
                    playerStates.remove(uuid);
                    return;
                }
                
                String squadName = dataManager.getPlayerSquad(uuid);
                if (squadName == null || !dataManager.isSquadLeader(squadName, uuid)) {
                    player.sendMessage("§cОшибка: вы не являетесь лидером отряда!");
                    playerStates.remove(uuid);
                    return;
                }
                
                if (!coinManager.hasCoins(uuid, amount)) {
                    player.sendMessage("§cНедостаточно монет!");
                    playerStates.remove(uuid);
                    return;
                }
                
                if (coinManager.removeCoins(uuid, amount)) {
                    dataManager.addToSquadTreasury(squadName, uuid, amount);
                    player.sendMessage("§aВ казну отряда добавлено: §e" + String.format("%.0f", amount) + " монет");
                } else {
                    player.sendMessage("§cОшибка при списании монет!");
                }
            } catch (NumberFormatException e) {
                player.sendMessage("§cВведите корректное число!");
            }
            playerStates.remove(uuid);
        } else if (state == MenuState.WAITING_TREASURY_WITHDRAW) {
            // Снятие из казны
            try {
                double amount = Double.parseDouble(message);
                if (amount <= 0) {
                    player.sendMessage("§cСумма должна быть больше 0!");
                    playerStates.remove(uuid);
                    return;
                }
                
                String squadName = dataManager.getPlayerSquad(uuid);
                if (squadName == null || !dataManager.isSquadLeader(squadName, uuid)) {
                    player.sendMessage("§cОшибка: вы не являетесь лидером отряда!");
                    playerStates.remove(uuid);
                    return;
                }
                
                if (dataManager.removeFromSquadTreasury(squadName, uuid, amount)) {
                    // Добавляем монеты игроку
                    coinManager.addCoins(uuid, amount);
                    player.sendMessage("§aИз казны отряда снято: §e" + String.format("%.0f", amount) + " монет");
                } else {
                    player.sendMessage("§cНедостаточно средств в казне отряда!");
                }
            } catch (NumberFormatException e) {
                player.sendMessage("§cВведите корректное число!");
            }
            playerStates.remove(uuid);
        } else if (state == MenuState.WAITING_JOIN_FEE) {
            // Установка сбора при вступлении
            try {
                double fee = Double.parseDouble(message);
                if (fee < 0) {
                    player.sendMessage("§cСбор не может быть отрицательным!");
                    playerStates.remove(uuid);
                    return;
                }
                
                String squadName = dataManager.getPlayerSquad(uuid);
                if (squadName == null || !dataManager.isSquadLeader(squadName, uuid)) {
                    player.sendMessage("§cОшибка: вы не являетесь лидером отряда!");
                    playerStates.remove(uuid);
                    return;
                }
                
                dataManager.setSquadJoinFee(squadName, uuid, fee);
                player.sendMessage("§aСбор при вступлении установлен: §e" + String.format("%.0f", fee) + " монет");
            } catch (NumberFormatException e) {
                player.sendMessage("§cВведите корректное число!");
            }
            playerStates.remove(uuid);
        } else if (state == MenuState.WAITING_JOIN_REQUEST_SQUAD) {
            // Выбор отряда для подачи запроса
            if (!dataManager.getAllSquads().contains(message)) {
                player.sendMessage("§cОтряд не найден!");
                playerStates.remove(uuid);
                return;
            }
            
            // Проверяем сбор
            double joinFee = dataManager.getSquadJoinFee(message);
            if (joinFee > 0 && !coinManager.hasCoins(uuid, joinFee)) {
                player.sendMessage("§cНедостаточно монет для вступления!");
                player.sendMessage("§7Требуется: §e" + String.format("%.0f", joinFee) + " монет");
                playerStates.remove(uuid);
                return;
            }
            
            // Подаем запрос
            if (dataManager.addJoinRequest(message, uuid)) {
                player.sendMessage("§aЗапрос на вступление отправлен!");
            } else {
                player.sendMessage("§cНе удалось отправить запрос!");
            }
            playerStates.remove(uuid);
        }
    }
}

