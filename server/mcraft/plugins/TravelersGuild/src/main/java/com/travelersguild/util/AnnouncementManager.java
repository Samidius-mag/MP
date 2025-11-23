package com.travelersguild.util;

import com.travelersguild.TravelersGuild;
import com.travelersguild.data.Rank;
import org.bukkit.entity.Player;
import org.bukkit.entity.Firework;
import org.bukkit.FireworkEffect;
import org.bukkit.Material;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.FireworkMeta;
import org.bukkit.scheduler.BukkitRunnable;
import org.bukkit.ChatColor;
import org.bukkit.Location;

import java.util.List;
import java.util.ArrayList;

public class AnnouncementManager {
    
    private final TravelersGuild plugin;
    
    public AnnouncementManager(TravelersGuild plugin) {
        this.plugin = plugin;
    }
    
    /**
     * Показывает бегущую строку при входе игрока с рангом S или SS
     */
    public void showRankAnnouncement(Player player, Rank rank) {
        String playerName = player.getName();
        String message;
        
        if (rank == Rank.S) {
            message = "§6§l═══════════════════════════════════════\n" +
                     "§e§lВНИМАНИЕ! В игру зашел великий " + playerName + " - ГЕРОЙ!\n" +
                     "§e§lПоклонитесь ему!\n" +
                     "§6§l═══════════════════════════════════════";
        } else if (rank == Rank.SS) {
            message = "§e§l§k§r§6§l═══════════════════════════════════════\n" +
                     "§e§l§k§r§e§lВНИМАНИЕ! В игру зашел великий " + playerName + " - УЛЬТРА ГЕРОЙ!\n" +
                     "§e§l§k§r§e§lПоклонитесь ему!\n" +
                     "§e§l§k§r§6§l═══════════════════════════════════════";
        } else {
            return;
        }
        
        // Отправляем сообщение всем игрокам
        for (Player onlinePlayer : plugin.getServer().getOnlinePlayers()) {
            onlinePlayer.sendMessage(message);
        }
        
        // Также отправляем в консоль
        plugin.getLogger().info("Rank announcement: " + playerName + " (" + rank.getCode() + ")");
    }
    
    /**
     * Празднует достижение ранга SS: салют и подарки
     */
    public void celebrateSSRank(Player player) {
        Location loc = player.getLocation();
        
        // Создаем салют из фейерверков
        new BukkitRunnable() {
            int count = 0;
            @Override
            public void run() {
                if (count >= 20) { // 20 фейерверков
                    cancel();
                    return;
                }
                
                // Создаем фейерверк в случайной позиции вокруг игрока
                double x = loc.getX() + (Math.random() - 0.5) * 10;
                double y = loc.getY() + 5 + Math.random() * 5;
                double z = loc.getZ() + (Math.random() - 0.5) * 10;
                
                Location fireworkLoc = new Location(loc.getWorld(), x, y, z);
                Firework firework = loc.getWorld().spawn(fireworkLoc, Firework.class);
                FireworkMeta meta = firework.getFireworkMeta();
                
                // Случайный цвет фейерверка
                FireworkEffect.Type type = FireworkEffect.Type.values()[
                    (int)(Math.random() * FireworkEffect.Type.values().length)
                ];
                
                FireworkEffect effect = FireworkEffect.builder()
                    .with(type)
                    .withColor(
                        org.bukkit.Color.fromRGB(
                            (int)(Math.random() * 255),
                            (int)(Math.random() * 255),
                            (int)(Math.random() * 255)
                        )
                    )
                    .withFade(
                        org.bukkit.Color.fromRGB(
                            (int)(Math.random() * 255),
                            (int)(Math.random() * 255),
                            (int)(Math.random() * 255)
                        )
                    )
                    .withFlicker()
                    .withTrail()
                    .build();
                
                meta.addEffect(effect);
                meta.setPower(2);
                firework.setFireworkMeta(meta);
                
                count++;
            }
        }.runTaskTimer(plugin, 0L, 5L); // Каждые 0.25 секунды
        
        // Дарим золотые яблоки всем игрокам онлайн
        new BukkitRunnable() {
            @Override
            public void run() {
                ItemStack goldenApple = new ItemStack(Material.GOLDEN_APPLE, 3);
                
                for (Player onlinePlayer : plugin.getServer().getOnlinePlayers()) {
                    if (onlinePlayer.getInventory().firstEmpty() != -1) {
                        onlinePlayer.getInventory().addItem(goldenApple);
                        onlinePlayer.sendMessage("§6§l═══════════════════════════");
                        onlinePlayer.sendMessage("§e§lПОДАРОК ОТ УЛЬТРА ГЕРОЯ!");
                        onlinePlayer.sendMessage("§6" + player.getName() + " §eдостиг ранга SS!");
                        onlinePlayer.sendMessage("§6Вы получили 3 золотых яблока!");
                        onlinePlayer.sendMessage("§6§l═══════════════════════════");
                    } else {
                        // Если инвентарь полон, дропаем на землю
                        onlinePlayer.getWorld().dropItemNaturally(
                            onlinePlayer.getLocation(),
                            goldenApple
                        );
                        onlinePlayer.sendMessage("§6§l═══════════════════════════");
                        onlinePlayer.sendMessage("§e§lПОДАРОК ОТ УЛЬТРА ГЕРОЯ!");
                        onlinePlayer.sendMessage("§6" + player.getName() + " §eдостиг ранга SS!");
                        onlinePlayer.sendMessage("§6Подарок упал на землю (инвентарь полон)!");
                        onlinePlayer.sendMessage("§6§l═══════════════════════════");
                    }
                }
            }
        }.runTaskLater(plugin, 60L); // Через 3 секунды
    }
}

