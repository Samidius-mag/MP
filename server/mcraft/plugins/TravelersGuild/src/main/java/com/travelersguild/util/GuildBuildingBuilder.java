package com.travelersguild.util;

import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.World;
import org.bukkit.block.Block;

public class GuildBuildingBuilder {
    
    /**
     * Строит здание гильдии путешественников в указанной локации
     * @param centerLocation Центральная точка постройки (где стоит игрок)
     */
    public static void buildGuildBuilding(Location centerLocation) {
        World world = centerLocation.getWorld();
        if (world == null) return;
        
        int centerX = centerLocation.getBlockX();
        int centerY = centerLocation.getBlockY();
        int centerZ = centerLocation.getBlockZ();
        
        // Фундамент (15x15 блоков)
        for (int x = -7; x <= 7; x++) {
            for (int z = -7; z <= 7; z++) {
                Block block = world.getBlockAt(centerX + x, centerY - 1, centerZ + z);
                block.setType(Material.STONE_BRICKS);
            }
        }
        
        // Стены (высота 5 блоков)
        for (int y = 0; y < 5; y++) {
            // Передняя и задняя стены
            for (int x = -7; x <= 7; x++) {
                Block frontBlock = world.getBlockAt(centerX + x, centerY + y, centerZ - 7);
                Block backBlock = world.getBlockAt(centerX + x, centerY + y, centerZ + 7);
                
                if (y == 0 || y == 4 || x == -7 || x == 7) {
                    frontBlock.setType(Material.OAK_LOG);
                    backBlock.setType(Material.OAK_LOG);
                } else {
                    frontBlock.setType(Material.OAK_PLANKS);
                    backBlock.setType(Material.OAK_PLANKS);
                }
            }
            
            // Боковые стены
            for (int z = -6; z <= 6; z++) {
                Block leftBlock = world.getBlockAt(centerX - 7, centerY + y, centerZ + z);
                Block rightBlock = world.getBlockAt(centerX + 7, centerY + y, centerZ + z);
                
                if (y == 0 || y == 4 || z == -6 || z == 6) {
                    leftBlock.setType(Material.OAK_LOG);
                    rightBlock.setType(Material.OAK_LOG);
                } else {
                    leftBlock.setType(Material.OAK_PLANKS);
                    rightBlock.setType(Material.OAK_PLANKS);
                }
            }
        }
        
        // Пол внутри здания
        for (int x = -6; x <= 6; x++) {
            for (int z = -6; z <= 6; z++) {
                Block floorBlock = world.getBlockAt(centerX + x, centerY, centerZ + z);
                floorBlock.setType(Material.OAK_PLANKS);
            }
        }
        
        // Крыша
        for (int y = 5; y < 7; y++) {
            int radius = 8 - (y - 5);
            for (int x = -radius; x <= radius; x++) {
                for (int z = -radius; z <= radius; z++) {
                    if (x * x + z * z <= radius * radius) {
                        Block roofBlock = world.getBlockAt(centerX + x, centerY + y, centerZ + z);
                        if (y == 5) {
                            roofBlock.setType(Material.OAK_PLANKS);
                        } else {
                            roofBlock.setType(Material.OAK_STAIRS);
                        }
                    }
                }
            }
        }
        
        // Вход (проем в передней стене)
        for (int y = 0; y < 3; y++) {
            for (int x = -1; x <= 1; x++) {
                Block doorBlock = world.getBlockAt(centerX + x, centerY + y, centerZ - 7);
                doorBlock.setType(Material.AIR);
            }
        }
        
        // Окна по бокам
        for (int y = 2; y < 4; y++) {
            // Левое окно
            world.getBlockAt(centerX - 7, centerY + y, centerZ).setType(Material.GLASS_PANE);
            // Правое окно
            world.getBlockAt(centerX + 7, centerY + y, centerZ).setType(Material.GLASS_PANE);
        }
        
        // Внутренние колонны для поддержки
        for (int y = 0; y < 5; y++) {
            // Угловые колонны
            world.getBlockAt(centerX - 5, centerY + y, centerZ - 5).setType(Material.OAK_LOG);
            world.getBlockAt(centerX + 5, centerY + y, centerZ - 5).setType(Material.OAK_LOG);
            world.getBlockAt(centerX - 5, centerY + y, centerZ + 5).setType(Material.OAK_LOG);
            world.getBlockAt(centerX + 5, centerY + y, centerZ + 5).setType(Material.OAK_LOG);
        }
        
        // Освещение внутри (факелы на стенах)
        world.getBlockAt(centerX - 6, centerY + 3, centerZ - 6).setType(Material.TORCH);
        world.getBlockAt(centerX + 6, centerY + 3, centerZ - 6).setType(Material.TORCH);
        world.getBlockAt(centerX - 6, centerY + 3, centerZ + 6).setType(Material.TORCH);
        world.getBlockAt(centerX + 6, centerY + 3, centerZ + 6).setType(Material.TORCH);
        
        // Центральный стол (для NPC)
        world.getBlockAt(centerX, centerY + 1, centerZ).setType(Material.OAK_PLANKS);
        world.getBlockAt(centerX, centerY + 2, centerZ).setType(Material.OAK_PLANKS);
    }
}

