package com.travelersguild;

import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.event.Listener;
import org.bukkit.event.EventHandler;
import org.bukkit.event.entity.EntityDeathEvent;
import org.bukkit.entity.Player;
import org.bukkit.entity.Monster;
import org.bukkit.Location;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import java.util.Arrays;
import java.util.UUID;
import java.util.Set;

import com.travelersguild.data.GuildDataManager;
import com.travelersguild.data.Rank;
import com.travelersguild.npc.GuildMasterNPC;
import com.travelersguild.menu.GuildMenu;
import com.travelersguild.util.NameColorManager;
import com.travelersguild.util.AnnouncementManager;
import com.travelersguild.util.GuildBuildingBuilder;
import com.travelersguild.economy.CoinManager;

public class TravelersGuild extends JavaPlugin implements Listener {
    
    private GuildDataManager dataManager;
    private CoinManager coinManager;
    private GuildMasterNPC guildMasterNPC;
    private GuildMenu guildMenu;
    private NameColorManager nameColorManager;
    private AnnouncementManager announcementManager;
    
    @Override
    public void onEnable() {
        // Сохраняем конфигурацию по умолчанию, если её нет
        saveDefaultConfig();
        
        // Инициализация менеджеров
        this.dataManager = new GuildDataManager(this);
        this.coinManager = new CoinManager(this);
        this.nameColorManager = new NameColorManager(this);
        this.announcementManager = new AnnouncementManager(this);
        this.guildMenu = new GuildMenu(this, dataManager, coinManager);
        this.guildMasterNPC = new GuildMasterNPC(this, dataManager, guildMenu);
        
        // Регистрация команд
        getCommand("guild").setExecutor(this);
        getCommand("guildadmin").setExecutor(this);
        
        // Регистрация событий
        getServer().getPluginManager().registerEvents(this, this);
        getServer().getPluginManager().registerEvents(guildMenu, this);
        getServer().getPluginManager().registerEvents(guildMasterNPC, this);
        
        // Загрузка NPC при старте
        getServer().getScheduler().runTaskLater(this, () -> {
            guildMasterNPC.loadOrSpawnNPC();
        }, 40L); // Задержка 2 секунды после загрузки мира
        
        getLogger().info("TravelersGuild плагин включен!");
    }
    
    @Override
    public void onDisable() {
        // Сохранение данных при выключении
        if (dataManager != null) {
            dataManager.saveAll();
        }
        // Удаляем все голограммы
        if (nameColorManager != null) {
            nameColorManager.getHologramManager().removeAllHolograms();
        }
        getLogger().info("TravelersGuild плагин выключен!");
    }
    
    @EventHandler
    public void onPlayerJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();
        
        // Обновляем цвет ника при входе (включая отряд)
        Rank rank = dataManager.getPlayerRank(player.getUniqueId());
        if (rank != null) {
            nameColorManager.updatePlayerNameColor(player, rank, true);
            
            // Показываем бегущую строку для рангов S и SS
            if (rank == Rank.S || rank == Rank.SS) {
                announcementManager.showRankAnnouncement(player, rank);
            }
            
            // Для ранга SS - салют и подарки
            if (rank == Rank.SS) {
                announcementManager.celebrateSSRank(player);
            }
        }
    }
    
    @EventHandler
    public void onPlayerQuit(PlayerQuitEvent event) {
        Player player = event.getPlayer();
        // Сохраняем данные игрока при выходе
        dataManager.savePlayerData(player.getUniqueId());
        // Удаляем голограмму игрока
        nameColorManager.getHologramManager().removePlayerHologram(player);
    }
    
    @EventHandler
    public void onEntityDeath(EntityDeathEvent event) {
        // Отслеживаем убийства монстров для системы рангов
        if (event.getEntity().getKiller() != null) {
            Player killer = event.getEntity().getKiller();
            
            if (event.getEntity() instanceof Monster) {
                // Получаем мир, в котором произошло убийство
                org.bukkit.World world = event.getEntity().getWorld();
                
                // Получаем отряд убийцы
                String squadName = dataManager.getPlayerSquad(killer.getUniqueId());
                
                // Список игроков, которым нужно засчитать убийство
                java.util.List<Player> playersToReward = new java.util.ArrayList<>();
                playersToReward.add(killer); // Всегда добавляем убийцу
                
                // Если игрок в отряде, добавляем всех онлайн игроков отряда в том же мире
                if (squadName != null) {
                    Set<UUID> squadMembers = dataManager.getSquadMembers(squadName);
                    for (UUID memberUuid : squadMembers) {
                        if (!memberUuid.equals(killer.getUniqueId())) {
                            Player member = getServer().getPlayer(memberUuid);
                            if (member != null && member.isOnline() && member.getWorld().equals(world)) {
                                playersToReward.add(member);
                            }
                        }
                    }
                }
                
                // Засчитываем убийство всем игрокам
                for (Player player : playersToReward) {
                    // Увеличиваем счетчик убийств монстров
                    int newKills = dataManager.addMonsterKill(player.getUniqueId());
                    
                    // Проверяем, нужно ли повысить ранг
                    Rank oldRank = dataManager.getPlayerRank(player.getUniqueId());
                    Rank newRank = Rank.getRankByKills(newKills);
                    
                    if (newRank != oldRank && newRank != null) {
                        // Ранг повысился!
                        dataManager.setPlayerRank(player.getUniqueId(), newRank);
                        nameColorManager.updatePlayerNameColor(player, newRank, true);
                        
                        player.sendMessage("§6═══════════════════════════");
                        player.sendMessage("§6§lПОВЫШЕНИЕ РАНГА!");
                        player.sendMessage("§eВаш новый ранг: §r" + newRank.getDisplayName());
                        player.sendMessage("§7Убийств монстров: §e" + newKills);
                        player.sendMessage("§6═══════════════════════════");
                        
                        // Если достигли ранга S или SS, показываем объявление
                        if (newRank == Rank.S || newRank == Rank.SS) {
                            announcementManager.showRankAnnouncement(player, newRank);
                        }
                        
                        // Для ранга SS - салют и подарки
                        if (newRank == Rank.SS) {
                            announcementManager.celebrateSSRank(player);
                        }
                    }
                }
                
                // Уведомляем игроков отряда о совместном убийстве
                if (squadName != null && playersToReward.size() > 1) {
                    String message = "§7[Отряд] §eУбийство монстра засчитано всем участникам отряда в этом мире!";
                    for (Player member : playersToReward) {
                        if (!member.equals(killer)) {
                            member.sendMessage(message);
                        }
                    }
                }
            }
        }
    }
    
    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (command.getName().equalsIgnoreCase("guild")) {
            if (!(sender instanceof Player)) {
                sender.sendMessage("Эта команда доступна только игрокам!");
                return true;
            }
            
            Player player = (Player) sender;
            guildMenu.showMainMenu(player);
            return true;
        }
        
        if (command.getName().equalsIgnoreCase("guildadmin")) {
            if (!sender.hasPermission("travelersguild.admin")) {
                sender.sendMessage("§cУ вас нет прав для использования этой команды!");
                return true;
            }
            
            if (args.length == 0) {
                sender.sendMessage("§cИспользование: /guildadmin <spawn [название]|remove|reload>");
                return true;
            }
            
            if (args[0].equalsIgnoreCase("spawn")) {
                if (sender instanceof Player) {
                    Player player = (Player) sender;
                    String guildName = "Гильдия Путешественников";
                    
                    // Если указано название гильдии
                    if (args.length > 1) {
                        guildName = String.join(" ", Arrays.copyOfRange(args, 1, args.length));
                    }
                    
                    guildMasterNPC.spawnNPCAtLocation(player.getLocation(), guildName);
                    sender.sendMessage("§aNPC заведующего создан в вашей локации!");
                    sender.sendMessage("§7Название гильдии: §e" + guildName);
                } else {
                    sender.sendMessage("§cЭта команда доступна только игрокам!");
                }
                return true;
            }
            
            if (args[0].equalsIgnoreCase("remove")) {
                guildMasterNPC.removeNPC();
                sender.sendMessage("§aNPC заведующего удален!");
                return true;
            }
            
            if (args[0].equalsIgnoreCase("reload")) {
                dataManager.reload();
                sender.sendMessage("§aДанные гильдии перезагружены!");
                return true;
            }
            
            if (args[0].equalsIgnoreCase("build")) {
                if (sender instanceof Player) {
                    Player player = (Player) sender;
                    Location buildLocation = player.getLocation();
                    
                    // Строим здание
                    GuildBuildingBuilder.buildGuildBuilding(buildLocation);
                    sender.sendMessage("§a═══════════════════════════");
                    sender.sendMessage("§aЗдание гильдии построено!");
                    sender.sendMessage("§7Координаты: §eX: " + buildLocation.getBlockX() + 
                                       " Y: " + buildLocation.getBlockY() + 
                                       " Z: " + buildLocation.getBlockZ());
                    sender.sendMessage("§7Используйте §e/guildadmin spawn §7для создания NPC");
                    sender.sendMessage("§a═══════════════════════════");
                } else {
                    sender.sendMessage("§cЭта команда доступна только игрокам!");
                }
                return true;
            }
            
            sender.sendMessage("§cИспользование: /guildadmin <spawn [название]|remove|reload|build>");
            return true;
        }
        
        return false;
    }
    
    public GuildDataManager getDataManager() {
        return dataManager;
    }
    
    public GuildMasterNPC getGuildMasterNPC() {
        return guildMasterNPC;
    }
    
    public NameColorManager getNameColorManager() {
        return nameColorManager;
    }
    
    public AnnouncementManager getAnnouncementManager() {
        return announcementManager;
    }
    
    public CoinManager getCoinManager() {
        return coinManager;
    }
}

