package com.travelersguild.npc;

import com.travelersguild.TravelersGuild;
import com.travelersguild.data.GuildDataManager;
import com.travelersguild.menu.GuildMenu;
import org.bukkit.entity.Villager;
import org.bukkit.entity.Player;
import org.bukkit.entity.Entity;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.EntityDamageEvent;
import org.bukkit.event.entity.EntityDamageByEntityEvent;
import org.bukkit.event.player.PlayerInteractEntityEvent;
import org.bukkit.Location;
import org.bukkit.configuration.file.FileConfiguration;

import java.util.UUID;

public class GuildMasterNPC implements Listener {
    
    private final TravelersGuild plugin;
    private final GuildDataManager dataManager;
    private final GuildMenu guildMenu;
    private Villager npc;
    private Location npcLocation;
    
    public GuildMasterNPC(TravelersGuild plugin, GuildDataManager dataManager, GuildMenu guildMenu) {
        this.plugin = plugin;
        this.dataManager = dataManager;
        this.guildMenu = guildMenu;
        loadNPCLocation();
    }
    
    private void loadNPCLocation() {
        FileConfiguration config = plugin.getConfig();
        if (config.contains("npc.location")) {
            double x = config.getDouble("npc.location.x");
            double y = config.getDouble("npc.location.y");
            double z = config.getDouble("npc.location.z");
            String worldName = config.getString("npc.location.world");
            
            if (worldName != null && plugin.getServer().getWorld(worldName) != null) {
                npcLocation = new Location(
                    plugin.getServer().getWorld(worldName),
                    x, y, z
                );
            }
        }
    }
    
    private void saveNPCLocation() {
        if (npcLocation != null) {
            FileConfiguration config = plugin.getConfig();
            config.set("npc.location.x", npcLocation.getX());
            config.set("npc.location.y", npcLocation.getY());
            config.set("npc.location.z", npcLocation.getZ());
            config.set("npc.location.world", npcLocation.getWorld().getName());
            plugin.saveConfig();
        }
    }
    
    public void loadOrSpawnNPC() {
        if (npcLocation == null) {
            // Если локация не задана, используем спавн мира
            npcLocation = plugin.getServer().getWorlds().get(0).getSpawnLocation();
            saveNPCLocation();
        }
        
        // Проверяем, не существует ли уже NPC
        for (Entity entity : npcLocation.getWorld().getNearbyEntities(npcLocation, 5, 5, 5)) {
            if (entity instanceof Villager && entity.getCustomName() != null &&
                entity.getCustomName().equals("§6§lЗаведующий Гильдией")) {
                npc = (Villager) entity;
                return;
            }
        }
        
        // Создаем нового NPC
        spawnNPCAtLocation(npcLocation);
    }
    
    public void spawnNPCAtLocation(Location location) {
        // Удаляем старого NPC, если есть
        if (npc != null && !npc.isDead()) {
            npc.remove();
        }
        
        // Создаем нового жителя
        npc = location.getWorld().spawn(location, Villager.class);
        npc.setCustomName("§6§lЗаведующий Гильдией");
        npc.setCustomNameVisible(true);
        npc.setAI(false); // Отключаем AI, чтобы не двигался
        npc.setInvulnerable(true); // Делаем бессмертным
        npc.setProfession(org.bukkit.entity.Villager.Profession.CARTOGRAPHER); // Картограф - подходит для путешественников
        
        // Сохраняем локацию
        npcLocation = location;
        saveNPCLocation();
    }
    
    @EventHandler
    public void onEntityDamage(EntityDamageEvent event) {
        if (event.getEntity() instanceof Villager) {
            Villager villager = (Villager) event.getEntity();
            if (villager.getCustomName() != null &&
                villager.getCustomName().equals("§6§lЗаведующий Гильдией")) {
                // Отменяем урон
                event.setCancelled(true);
                
                // Если урон нанесен игроком, наказываем его
                if (event instanceof EntityDamageByEntityEvent) {
                    EntityDamageByEntityEvent damageEvent = (EntityDamageByEntityEvent) event;
                    if (damageEvent.getDamager() instanceof Player) {
                        Player attacker = (Player) damageEvent.getDamager();
                        punishAttacker(attacker);
                    }
                }
            }
        }
    }
    
    private void punishAttacker(Player attacker) {
        // Убиваем игрока
        attacker.setHealth(0);
        attacker.sendMessage("§c§l═══════════════════════════");
        attacker.sendMessage("§c§lВЫ НЕ МОЖЕТЕ АТАКОВАТЬ ЗАВЕДУЮЩЕГО!");
        attacker.sendMessage("§cВы были убиты и забанены на 5 минут!");
        attacker.sendMessage("§c§l═══════════════════════════");
        
        // Баним на 5 минут
        String banReason = "Атака на Заведующего Гильдией";
        
        // Используем временный бан через команду (Paper/Spigot поддерживает временные баны)
        plugin.getServer().getScheduler().runTask(plugin, () -> {
            try {
                // Пытаемся использовать команду бана с временем
                plugin.getServer().dispatchCommand(
                    plugin.getServer().getConsoleSender(),
                    "tempban " + attacker.getName() + " 5m " + banReason
                );
            } catch (Exception e) {
                // Если команда tempban не поддерживается, используем обычный бан
                // и кикаем игрока (админ может разбанить вручную)
                attacker.kickPlayer("§c§lВы были забанены на 5 минут за атаку на Заведующего Гильдией!");
                plugin.getLogger().warning("Игрок " + attacker.getName() + " был кикнут за атаку на NPC. Разбаньте его вручную через 5 минут.");
            }
        });
    }
    
    @EventHandler
    public void onPlayerInteractEntity(PlayerInteractEntityEvent event) {
        if (event.getRightClicked() instanceof Villager) {
            Villager villager = (Villager) event.getRightClicked();
            if (villager.getCustomName() != null &&
                villager.getCustomName().equals("§6§lЗаведующий Гильдией")) {
                event.setCancelled(true);
                
                Player player = event.getPlayer();
                // Открываем меню гильдии
                guildMenu.showMainMenu(player);
            }
        }
    }
    
    public Villager getNPC() {
        return npc;
    }
    
    public Location getNPCLocation() {
        return npcLocation;
    }
}

