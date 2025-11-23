package com.travelersguild;

import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.event.Listener;
import org.bukkit.event.EventHandler;
import org.bukkit.event.entity.EntityDeathEvent;
import org.bukkit.entity.Player;
import org.bukkit.entity.Monster;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;

import com.travelersguild.data.GuildDataManager;
import com.travelersguild.data.Rank;
import com.travelersguild.npc.GuildMasterNPC;
import com.travelersguild.menu.GuildMenu;
import com.travelersguild.util.NameColorManager;
import com.travelersguild.util.AnnouncementManager;

public class TravelersGuild extends JavaPlugin implements Listener {
    
    private GuildDataManager dataManager;
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
        this.nameColorManager = new NameColorManager(this);
        this.announcementManager = new AnnouncementManager(this);
        this.guildMenu = new GuildMenu(this, dataManager);
        this.guildMasterNPC = new GuildMasterNPC(this, dataManager, guildMenu);
        
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
        getLogger().info("TravelersGuild плагин выключен!");
    }
    
    @EventHandler
    public void onPlayerJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();
        
        // Обновляем цвет ника при входе
        Rank rank = dataManager.getPlayerRank(player.getUniqueId());
        if (rank != null) {
            nameColorManager.updatePlayerNameColor(player, rank);
            
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
    }
    
    @EventHandler
    public void onEntityDeath(EntityDeathEvent event) {
        // Отслеживаем убийства монстров для системы рангов
        if (event.getEntity().getKiller() != null) {
            Player killer = event.getEntity().getKiller();
            
            if (event.getEntity() instanceof Monster) {
                // Увеличиваем счетчик убийств монстров
                int newKills = dataManager.addMonsterKill(killer.getUniqueId());
                
                // Проверяем, нужно ли повысить ранг
                Rank oldRank = dataManager.getPlayerRank(killer.getUniqueId());
                Rank newRank = Rank.getRankByKills(newKills);
                
                if (newRank != oldRank && newRank != null) {
                    // Ранг повысился!
                    dataManager.setPlayerRank(killer.getUniqueId(), newRank);
                    nameColorManager.updatePlayerNameColor(killer, newRank);
                    
                    killer.sendMessage("§6═══════════════════════════");
                    killer.sendMessage("§6§lПОВЫШЕНИЕ РАНГА!");
                    killer.sendMessage("§eВаш новый ранг: §r" + newRank.getDisplayName());
                    killer.sendMessage("§7Убийств монстров: §e" + newKills);
                    killer.sendMessage("§6═══════════════════════════");
                    
                    // Если достигли ранга S или SS, показываем объявление
                    if (newRank == Rank.S || newRank == Rank.SS) {
                        announcementManager.showRankAnnouncement(killer, newRank);
                    }
                    
                    // Для ранга SS - салют и подарки
                    if (newRank == Rank.SS) {
                        announcementManager.celebrateSSRank(killer);
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
                sender.sendMessage("§cИспользование: /guildadmin <spawn|reload>");
                return true;
            }
            
            if (args[0].equalsIgnoreCase("spawn")) {
                if (sender instanceof Player) {
                    Player player = (Player) sender;
                    guildMasterNPC.spawnNPCAtLocation(player.getLocation());
                    sender.sendMessage("§aNPC заведующего создан в вашей локации!");
                } else {
                    sender.sendMessage("§cЭта команда доступна только игрокам!");
                }
                return true;
            }
            
            if (args[0].equalsIgnoreCase("reload")) {
                dataManager.reload();
                sender.sendMessage("§aДанные гильдии перезагружены!");
                return true;
            }
            
            sender.sendMessage("§cИспользование: /guildadmin <spawn|reload>");
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
}

