package com.travelersguild.util;

import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.World;
import org.bukkit.block.Block;
import org.bukkit.block.BlockFace;
import org.bukkit.block.data.BlockData;
import org.bukkit.block.data.type.Stairs;

public class GuildBuildingBuilder {
    
    /**
     * Строит здание гильдии путешественников в стиле аниме
     * Многоуровневое здание с изогнутыми крышами
     * @param centerLocation Центральная точка постройки (где стоит игрок)
     */
    public static void buildGuildBuilding(Location centerLocation) {
        World world = centerLocation.getWorld();
        if (world == null) return;
        
        int centerX = centerLocation.getBlockX();
        int centerY = centerLocation.getBlockY();
        int centerZ = centerLocation.getBlockZ();
        
        // Фундамент
        buildFoundation(world, centerX, centerY, centerZ);
        
        // Основное здание с неправильной формой
        buildMainStructure(world, centerX, centerY, centerZ);
        
        // Крыши с изогнутыми краями
        buildCurvedRoofs(world, centerX, centerY, centerZ);
        
        // Окна с решетками
        buildWindows(world, centerX, centerY, centerZ);
        
        // Главный вход с аркой
        buildMainEntrance(world, centerX, centerY, centerZ);
        
        // Декоративные элементы вокруг здания
        buildDecorativeElements(world, centerX, centerY, centerZ);
        
        // Внутренние помещения
        buildInterior(world, centerX, centerY, centerZ);
    }
    
    private static void buildFoundation(World world, int cx, int cy, int cz) {
        // Фундамент из каменных кирпичей
        for (int x = -20; x <= 20; x++) {
            for (int z = -20; z <= 20; z++) {
                if (isInBuildingFootprint(x, z)) {
                    world.getBlockAt(cx + x, cy - 1, cz + z).setType(Material.STONE_BRICKS);
                }
            }
        }
    }
    
    private static boolean isInBuildingFootprint(int x, int z) {
        // Неправильная форма здания - комбинация прямоугольников с выступами
        // Центральная часть (основное здание)
        if (x >= -8 && x <= 8 && z >= -10 && z <= 10) return true;
        // Левое крыло (выступает)
        if (x >= -15 && x <= -9 && z >= -8 && z <= 8) return true;
        // Правое крыло (меньше левого)
        if (x >= 9 && x <= 15 && z >= -6 && z <= 6) return true;
        // Передняя часть (выступ)
        if (x >= -6 && x <= 6 && z >= 11 && z <= 15) return true;
        // Небольшие выступы по углам
        if (x >= -10 && x <= -8 && z >= 8 && z <= 12) return true;
        if (x >= 8 && x <= 10 && z >= 8 && z <= 12) return true;
        return false;
    }
    
    private static void buildMainStructure(World world, int cx, int cy, int cz) {
        // Стены из разных материалов по высоте
        for (int y = 0; y < 12; y++) {
            for (int x = -20; x <= 20; x++) {
                for (int z = -20; z <= 20; z++) {
                    if (!isInBuildingFootprint(x, z)) continue;
                    
                    // Проверяем, это стена или внутреннее пространство
                    boolean isWall = !isInBuildingFootprint(x - 1, z) || 
                                    !isInBuildingFootprint(x + 1, z) ||
                                    !isInBuildingFootprint(x, z - 1) || 
                                    !isInBuildingFootprint(x, z + 1);
                    
                    if (isWall) {
                        Block block = world.getBlockAt(cx + x, cy + y, cz + z);
                        
                        // Нижняя часть - камень
                        if (y < 3) {
                            block.setType(Material.STONE_BRICKS);
                        }
                        // Средняя часть - кирпич
                        else if (y < 6) {
                            block.setType(Material.BRICKS);
                        }
                        // Верхняя часть - темное дерево
                        else {
                            block.setType(Material.DARK_OAK_PLANKS);
                        }
                    } else if (y == 0) {
                        // Пол внутри
                        world.getBlockAt(cx + x, cy + y, cz + z).setType(Material.DARK_OAK_PLANKS);
                    }
                }
            }
        }
        
        // Деревянные балки (структурные элементы)
        for (int y = 0; y < 12; y++) {
            // Угловые колонны
            for (int[] corner : new int[][]{{-8, -10}, {8, -10}, {-8, 10}, {8, 10}}) {
                world.getBlockAt(cx + corner[0], cy + y, cz + corner[1]).setType(Material.DARK_OAK_LOG);
            }
        }
    }
    
    private static void buildCurvedRoofs(World world, int cx, int cy, int cz) {
        int baseHeight = 12;
        
        // Центральная крыша (самая высокая)
        buildRoofSection(world, cx, cy + baseHeight, cz, -8, 8, -10, 10, 6, Material.DARK_OAK_PLANKS);
        
        // Левое крыло
        buildRoofSection(world, cx, cy + baseHeight, cz, -15, -9, -8, 8, 4, Material.DARK_OAK_PLANKS);
        
        // Правое крыло
        buildRoofSection(world, cx, cy + baseHeight, cz, 9, 15, -6, 6, 4, Material.DARK_OAK_PLANKS);
        
        // Передняя часть
        buildRoofSection(world, cx, cy + baseHeight, cz, -6, 6, 11, 15, 3, Material.DARK_OAK_PLANKS);
        
        // Шпиль на центральной крыше
        for (int y = 0; y < 4; y++) {
            world.getBlockAt(cx, cy + baseHeight + 6 + y, cz).setType(Material.DARK_OAK_LOG);
        }
    }
    
    private static void buildRoofSection(World world, int cx, int cy, int cz, 
                                         int minX, int maxX, int minZ, int maxZ, 
                                         int height, Material material) {
        int centerX = (minX + maxX) / 2;
        int centerZ = (minZ + maxZ) / 2;
        
        for (int layer = 0; layer < height; layer++) {
            int maxRadius = Math.max(maxX - minX, maxZ - minZ) / 2;
            int radius = maxRadius - layer;
            if (radius < 0) break;
            
            for (int x = minX; x <= maxX; x++) {
                for (int z = minZ; z <= maxZ; z++) {
                    int dx = x - centerX;
                    int dz = z - centerZ;
                    double distance = Math.sqrt(dx * dx + dz * dz);
                    
                    // Изогнутые края крыши с более плавным переходом
                    if (distance <= radius) {
                        // Создаем изогнутый профиль
                        double curveFactor = 1.0 - (distance / maxRadius);
                        int layerHeight = (int)(layer + curveFactor * 0.5);
                        
                        Block block = world.getBlockAt(cx + x, cy + layerHeight, cz + z);
                        
                        // Верхний слой и края - красная терракота для изогнутых краев
                        if (layer == height - 1 || distance > radius - 0.5) {
                            block.setType(Material.RED_TERRACOTTA);
                        } else {
                            block.setType(material);
                        }
                    }
                }
            }
        }
    }
    
    private static void buildWindows(World world, int cx, int cy, int cz) {
        // Окна с темными решетками (железные прутья)
        int[] windowHeights = {4, 5, 6, 7, 8};
        
        // Окна на передней стене
        for (int x = -6; x <= 6; x += 3) {
            for (int y : windowHeights) {
                if (x != 0 || y != 6) { // Пропускаем место для входа
                    world.getBlockAt(cx + x, cy + y, cz - 10).setType(Material.IRON_BARS);
                }
            }
        }
        
        // Окна на боковых стенах
        for (int z = -8; z <= 8; z += 4) {
            for (int y : windowHeights) {
                world.getBlockAt(cx - 8, cy + y, cz + z).setType(Material.IRON_BARS);
                world.getBlockAt(cx + 8, cy + y, cz + z).setType(Material.IRON_BARS);
            }
        }
        
        // Окна на задней стене
        for (int x = -6; x <= 6; x += 3) {
            for (int y : windowHeights) {
                world.getBlockAt(cx + x, cy + y, cz + 10).setType(Material.IRON_BARS);
            }
        }
    }
    
    private static void buildMainEntrance(World world, int cx, int cy, int cz) {
        // Арка входа из кирпича
        for (int y = 0; y < 6; y++) {
            for (int x = -2; x <= 2; x++) {
                // Проем
                if (y < 5 && x >= -1 && x <= 1) {
                    world.getBlockAt(cx + x, cy + y, cz - 10).setType(Material.AIR);
                } else {
                    // Арка из кирпича
                    world.getBlockAt(cx + x, cy + y, cz - 10).setType(Material.BRICKS);
                }
            }
        }
        
        // Ступени перед входом
        for (int step = 0; step < 3; step++) {
            for (int x = -2 - step; x <= 2 + step; x++) {
                for (int z = -11 - step; z <= -10; z++) {
                    world.getBlockAt(cx + x, cy - step, cz + z).setType(Material.STONE_BRICKS);
                }
            }
        }
    }
    
    private static void buildDecorativeElements(World world, int cx, int cy, int cz) {
        // Декоративные деревья/столбы вокруг здания
        int[] treePositions = {
            -18, -12,  // Левая сторона
            12, 18,    // Правая сторона
            -18, 18    // Задняя сторона
        };
        
        for (int x : treePositions) {
            for (int y = 0; y < 4; y++) {
                world.getBlockAt(cx + x, cy + y, cz - 8).setType(Material.DARK_OAK_LOG);
                world.getBlockAt(cx + x, cy + y, cz + 8).setType(Material.DARK_OAK_LOG);
            }
        }
        
        for (int z : treePositions) {
            for (int y = 0; y < 4; y++) {
                world.getBlockAt(cx - 8, cy + y, cz + z).setType(Material.DARK_OAK_LOG);
                world.getBlockAt(cx + 8, cy + y, cz + z).setType(Material.DARK_OAK_LOG);
            }
        }
        
        // Каменные блоки на траве
        int[][] stonePositions = {{-12, -12}, {12, -12}, {-12, 12}, {12, 12}};
        for (int[] pos : stonePositions) {
            world.getBlockAt(cx + pos[0], cy, cz + pos[1]).setType(Material.STONE);
        }
    }
    
    private static void buildInterior(World world, int cx, int cy, int cz) {
        // Главный зал - стойка регистрации
        for (int x = -3; x <= 3; x++) {
            for (int z = -8; z <= -6; z++) {
                world.getBlockAt(cx + x, cy + 1, cz + z).setType(Material.DARK_OAK_PLANKS);
                world.getBlockAt(cx + x, cy + 2, cz + z).setType(Material.DARK_OAK_PLANKS);
            }
        }
        
        // Полки с книгами
        for (int y = 2; y < 6; y++) {
            for (int x = -7; x <= 7; x += 3) {
                world.getBlockAt(cx + x, cy + y, cz - 9).setType(Material.BOOKSHELF);
                world.getBlockAt(cx + x, cy + y, cz + 9).setType(Material.BOOKSHELF);
            }
        }
        
        // Колонны внутри
        for (int y = 0; y < 10; y++) {
            world.getBlockAt(cx - 6, cy + y, cz - 6).setType(Material.DARK_OAK_LOG);
            world.getBlockAt(cx + 6, cy + y, cz - 6).setType(Material.DARK_OAK_LOG);
            world.getBlockAt(cx - 6, cy + y, cz + 6).setType(Material.DARK_OAK_LOG);
            world.getBlockAt(cx + 6, cy + y, cz + 6).setType(Material.DARK_OAK_LOG);
        }
        
        // Освещение (факелы и лампы)
        for (int x = -6; x <= 6; x += 3) {
            for (int z = -6; z <= 6; z += 3) {
                if (x != 0 || z != 0) {
                    world.getBlockAt(cx + x, cy + 10, cz + z).setType(Material.TORCH);
                }
            }
        }
        
        // Центральная площадка для NPC
        world.getBlockAt(cx, cy + 1, cz).setType(Material.DARK_OAK_PLANKS);
        world.getBlockAt(cx, cy + 2, cz).setType(Material.DARK_OAK_PLANKS);
    }
}




