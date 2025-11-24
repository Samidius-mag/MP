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
     * Размер: 50x50x50 блоков
     * @param centerLocation Центральная точка постройки (где стоит игрок)
     */
    public static void buildGuildBuilding(Location centerLocation) {
        World world = centerLocation.getWorld();
        if (world == null) return;
        
        int centerX = centerLocation.getBlockX();
        int centerY = centerLocation.getBlockY();
        int centerZ = centerLocation.getBlockZ();
        
        // Очищаем область перед постройкой (опционально, можно закомментировать)
        // clearArea(world, centerX, centerY, centerZ, 25);
        
        // Фундамент (50x50 блоков)
        buildFoundation(world, centerX, centerY, centerZ);
        
        // Главный зал (центральная часть)
        buildMainHall(world, centerX, centerY, centerZ);
        
        // Библиотека-архив (левая часть)
        buildLibrary(world, centerX, centerY, centerZ);
        
        // Комната отдыха (правая часть)
        buildLounge(world, centerX, centerY, centerZ);
        
        // Внешний двор
        buildCourtyard(world, centerX, centerY, centerZ);
        
        // Крыша в стиле аниме (высокие шатровые крыши)
        buildAnimeStyleRoof(world, centerX, centerY, centerZ);
        
        // Декоративные элементы
        buildDecorations(world, centerX, centerY, centerZ);
    }
    
    private static void buildFoundation(World world, int cx, int cy, int cz) {
        // Фундамент из каменных кирпичей и полированного базальта
        for (int x = -25; x <= 25; x++) {
            for (int z = -25; z <= 25; z++) {
                Block block = world.getBlockAt(cx + x, cy - 1, cz + z);
                // Чередуем материалы для красоты
                if ((x + z) % 3 == 0) {
                    block.setType(Material.POLISHED_BASALT);
                } else {
                    block.setType(Material.STONE_BRICKS);
                }
            }
        }
    }
    
    private static void buildMainHall(World world, int cx, int cy, int cz) {
        // Главный зал: 20x20 блоков, высота 15 блоков
        int hallSize = 10;
        int hallHeight = 15;
        
        // Стены главного зала
        for (int y = 0; y < hallHeight; y++) {
            for (int x = -hallSize; x <= hallSize; x++) {
                // Передняя и задняя стены
                setWallBlock(world, cx + x, cy + y, cz - hallSize, y, hallHeight);
                setWallBlock(world, cx + x, cy + y, cz + hallSize, y, hallHeight);
            }
            for (int z = -hallSize + 1; z < hallSize; z++) {
                // Боковые стены
                setWallBlock(world, cx - hallSize, cy + y, cz + z, y, hallHeight);
                setWallBlock(world, cx + hallSize, cy + y, cz + z, y, hallHeight);
            }
        }
        
        // Пол главного зала
        for (int x = -hallSize + 1; x < hallSize; x++) {
            for (int z = -hallSize + 1; z < hallSize; z++) {
                Block floor = world.getBlockAt(cx + x, cy, cz + z);
                if ((x + z) % 2 == 0) {
                    floor.setType(Material.DARK_OAK_PLANKS);
                } else {
                    floor.setType(Material.OAK_PLANKS);
                }
            }
        }
        
        // Высокая стойка регистрации (в центре зала, ближе к входу)
        for (int x = -3; x <= 3; x++) {
            for (int z = -8; z <= -6; z++) {
                Block counter = world.getBlockAt(cx + x, cy + 1, cz + z);
                counter.setType(Material.DARK_OAK_PLANKS);
            }
        }
        // Верхняя часть стойки
        for (int x = -3; x <= 3; x++) {
            for (int z = -8; z <= -6; z++) {
                Block counter = world.getBlockAt(cx + x, cy + 2, cz + z);
                counter.setType(Material.DARK_OAK_PLANKS);
            }
        }
        
        // Полки с книгами на стенах
        for (int y = 2; y < 6; y++) {
            for (int x = -8; x <= 8; x += 4) {
                world.getBlockAt(cx + x, cy + y, cz - hallSize + 1).setType(Material.BOOKSHELF);
                world.getBlockAt(cx + x, cy + y, cz + hallSize - 1).setType(Material.BOOKSHELF);
            }
        }
        
        // Флаги и свитки на стенах (используем знамена)
        for (int y = 8; y < 12; y++) {
            world.getBlockAt(cx - hallSize + 1, cy + y, cz - 5).setType(Material.RED_BANNER);
            world.getBlockAt(cx - hallSize + 1, cy + y, cz).setType(Material.BLUE_BANNER);
            world.getBlockAt(cx - hallSize + 1, cy + y, cz + 5).setType(Material.YELLOW_BANNER);
        }
        
        // Колонны для поддержки высокого потолка
        for (int y = 0; y < hallHeight; y++) {
            world.getBlockAt(cx - 6, cy + y, cz - 6).setType(Material.DARK_OAK_LOG);
            world.getBlockAt(cx + 6, cy + y, cz - 6).setType(Material.DARK_OAK_LOG);
            world.getBlockAt(cx - 6, cy + y, cz + 6).setType(Material.DARK_OAK_LOG);
            world.getBlockAt(cx + 6, cy + y, cz + 6).setType(Material.DARK_OAK_LOG);
        }
        
        // Освещение (подвесные фонари - красные факелы)
        for (int x = -8; x <= 8; x += 4) {
            for (int z = -8; z <= 8; z += 4) {
                world.getBlockAt(cx + x, cy + hallHeight - 2, cz + z).setType(Material.REDSTONE_LAMP);
                world.getBlockAt(cx + x, cy + hallHeight - 1, cz + z).setType(Material.REDSTONE_TORCH);
            }
        }
        
        // Вход в главный зал (большой проем)
        for (int y = 0; y < 5; y++) {
            for (int x = -3; x <= 3; x++) {
                world.getBlockAt(cx + x, cy + y, cz - hallSize).setType(Material.AIR);
            }
        }
    }
    
    private static void buildLibrary(World world, int cx, int cy, int cz) {
        // Библиотека: левая часть, 15x20 блоков, 2 этажа
        int libStartX = -25;
        int libEndX = -11;
        int libStartZ = -10;
        int libEndZ = 10;
        int libHeight = 10;
        
        // Стены библиотеки
        for (int y = 0; y < libHeight; y++) {
            // Внешние стены
            for (int x = libStartX; x <= libEndX; x++) {
                setWallBlock(world, cx + x, cy + y, cz + libStartZ, y, libHeight);
                setWallBlock(world, cx + x, cy + y, cz + libEndZ, y, libHeight);
            }
            for (int z = libStartZ + 1; z < libEndZ; z++) {
                setWallBlock(world, cx + libStartX, cy + y, cz + z, y, libHeight);
                setWallBlock(world, cx + libEndX, cy + y, cz + z, y, libHeight);
            }
        }
        
        // Пол библиотеки
        for (int x = libStartX + 1; x < libEndX; x++) {
            for (int z = libStartZ + 1; z < libEndZ; z++) {
                world.getBlockAt(cx + x, cy, cz + z).setType(Material.BIRCH_PLANKS);
            }
        }
        
        // Многоуровневые книжные шкафы
        for (int y = 1; y < 8; y++) {
            for (int z = libStartZ + 2; z < libEndZ; z += 3) {
                for (int x = libStartX + 2; x < libEndX - 1; x += 2) {
                    world.getBlockAt(cx + x, cy + y, cz + z).setType(Material.BOOKSHELF);
                }
            }
        }
        
        // Лестницы между уровнями
        for (int x = libEndX - 2; x >= libStartX + 2; x -= 4) {
            for (int y = 0; y < 5; y++) {
                Block stairs = world.getBlockAt(cx + x, cy + y, cz + libStartZ + 1);
                stairs.setType(Material.OAK_STAIRS);
                BlockData data = stairs.getBlockData();
                if (data instanceof Stairs) {
                    Stairs stairsData = (Stairs) data;
                    stairsData.setFacing(BlockFace.EAST);
                    stairs.setBlockData(stairsData);
                }
            }
        }
        
        // Сундуки с картами
        for (int x = libStartX + 3; x < libEndX - 2; x += 4) {
            world.getBlockAt(cx + x, cy + 1, cz + libEndZ - 2).setType(Material.CHEST);
        }
        
        // Стенд с артефактами (рамки)
        world.getBlockAt(cx + libEndX - 2, cy + 3, cz).setType(Material.ITEM_FRAME);
        world.getBlockAt(cx + libEndX - 2, cy + 4, cz).setType(Material.ITEM_FRAME);
        world.getBlockAt(cx + libEndX - 2, cy + 5, cz).setType(Material.ITEM_FRAME);
        
        // Освещение (свечи)
        for (int x = libStartX + 3; x < libEndX; x += 4) {
            for (int z = libStartZ + 3; z < libEndZ; z += 4) {
                world.getBlockAt(cx + x, cy + 8, cz + z).setType(Material.CANDLE);
            }
        }
        
        // Проход из главного зала
        for (int y = 0; y < 4; y++) {
            for (int x = -1; x <= 1; x++) {
                world.getBlockAt(cx + libEndX, cy + y, cz + x).setType(Material.AIR);
            }
        }
    }
    
    private static void buildLounge(World world, int cx, int cy, int cz) {
        // Комната отдыха: правая часть, 15x20 блоков
        int loungeStartX = 11;
        int loungeEndX = 25;
        int loungeStartZ = -10;
        int loungeEndZ = 10;
        int loungeHeight = 8;
        
        // Стены комнаты отдыха
        for (int y = 0; y < loungeHeight; y++) {
            for (int x = loungeStartX; x <= loungeEndX; x++) {
                setWallBlock(world, cx + x, cy + y, cz + loungeStartZ, y, loungeHeight);
                setWallBlock(world, cx + x, cy + y, cz + loungeEndZ, y, loungeHeight);
            }
            for (int z = loungeStartZ + 1; z < loungeEndZ; z++) {
                setWallBlock(world, cx + loungeStartX, cy + y, cz + z, y, loungeHeight);
                setWallBlock(world, cx + loungeEndX, cy + y, cz + z, y, loungeHeight);
            }
        }
        
        // Пол комнаты отдыха
        for (int x = loungeStartX + 1; x < loungeEndX; x++) {
            for (int z = loungeStartZ + 1; z < loungeEndZ; z++) {
                world.getBlockAt(cx + x, cy, cz + z).setType(Material.BEIGE_CARPET);
            }
        }
        
        // Низкие столики (шерсть как подушки)
        for (int x = loungeStartX + 3; x < loungeEndX - 2; x += 4) {
            for (int z = loungeStartZ + 3; z < loungeEndZ - 2; z += 4) {
                // Стол
                world.getBlockAt(cx + x, cy + 1, cz + z).setType(Material.DARK_OAK_PLANKS);
                // Подушки вокруг стола
                world.getBlockAt(cx + x - 1, cy, cz + z).setType(Material.RED_WOOL);
                world.getBlockAt(cx + x + 1, cy, cz + z).setType(Material.BLUE_WOOL);
                world.getBlockAt(cx + x, cy, cz + z - 1).setType(Material.YELLOW_WOOL);
                world.getBlockAt(cx + x, cy, cz + z + 1).setType(Material.GREEN_WOOL);
            }
        }
        
        // Растения в горшках
        for (int x = loungeStartX + 2; x < loungeEndX; x += 5) {
            for (int z = loungeStartZ + 2; z < loungeEndZ; z += 5) {
                world.getBlockAt(cx + x, cy + 1, cz + z).setType(Material.FLOWER_POT);
            }
        }
        
        // Доска объявлений (рамки с бумагами)
        for (int y = 2; y < 6; y++) {
            for (int z = loungeStartZ + 1; z < loungeStartZ + 4; z++) {
                world.getBlockAt(cx + loungeStartX + 1, cy + y, cz + z).setType(Material.ITEM_FRAME);
            }
        }
        
        // Освещение (лампы)
        for (int x = loungeStartX + 3; x < loungeEndX; x += 4) {
            for (int z = loungeStartZ + 3; z < loungeEndZ; z += 4) {
                world.getBlockAt(cx + x, cy + loungeHeight - 1, cz + z).setType(Material.LANTERN);
            }
        }
        
        // Проход из главного зала
        for (int y = 0; y < 4; y++) {
            for (int x = -1; x <= 1; x++) {
                world.getBlockAt(cx + loungeStartX, cy + y, cz + x).setType(Material.AIR);
            }
        }
    }
    
    private static void buildCourtyard(World world, int cx, int cy, int cz) {
        // Внешний двор вокруг здания
        
        // Костёр для собраний (в центре двора перед входом)
        world.getBlockAt(cx, cy, cz - 12).setType(Material.CAMPFIRE);
        
        // Верстак и печка
        world.getBlockAt(cx - 5, cy, cz - 12).setType(Material.CRAFTING_TABLE);
        world.getBlockAt(cx + 5, cy, cz - 12).setType(Material.FURNACE);
        
        // Конюшня (простая структура)
        int stableX = cx + 15;
        int stableZ = cz - 15;
        for (int x = 0; x < 8; x++) {
            for (int z = 0; z < 8; z++) {
                if (x == 0 || x == 7 || z == 0 || z == 7) {
                    world.getBlockAt(stableX + x, cy, cz + stableZ + z).setType(Material.OAK_FENCE);
                } else {
                    world.getBlockAt(stableX + x, cy, cz + stableZ + z).setType(Material.HAY_BLOCK);
                }
            }
        }
        
        // Сад с редкими растениями
        for (int x = -20; x <= -15; x++) {
            for (int z = 15; z <= 20; z++) {
                if ((x + z) % 2 == 0) {
                    world.getBlockAt(cx + x, cy, cz + z).setType(Material.GRASS_BLOCK);
                    world.getBlockAt(cx + x, cy + 1, cz + z).setType(Material.SUNFLOWER);
                } else {
                    world.getBlockAt(cx + x, cy, cz + z).setType(Material.GRASS_BLOCK);
                }
            }
        }
        
        // Фонари вокруг двора
        for (int angle = 0; angle < 360; angle += 45) {
            double rad = Math.toRadians(angle);
            int x = (int) (Math.cos(rad) * 20);
            int z = (int) (Math.sin(rad) * 20);
            world.getBlockAt(cx + x, cy + 1, cz + z).setType(Material.LANTERN);
        }
        
        // Каменные стелы
        for (int angle = 0; angle < 360; angle += 90) {
            double rad = Math.toRadians(angle);
            int x = (int) (Math.cos(rad) * 18);
            int z = (int) (Math.sin(rad) * 18);
            for (int y = 0; y < 3; y++) {
                world.getBlockAt(cx + x, cy + y, cz + z).setType(Material.STONE_BRICKS);
            }
        }
        
        // Тропы из гравия
        for (int x = -3; x <= 3; x++) {
            world.getBlockAt(cx + x, cy, cz - 12).setType(Material.GRAVEL);
        }
        for (int z = -12; z <= -10; z++) {
            world.getBlockAt(cx, cy, cz + z).setType(Material.GRAVEL);
        }
    }
    
    private static void buildAnimeStyleRoof(World world, int cx, int cy, int cz) {
        // Высокие шатровые крыши с загнутыми краями в стиле аниме
        
        // Главный зал - высокая шатровая крыша
        int mainHallHeight = 15;
        int roofHeight = 8;
        for (int layer = 0; layer < roofHeight; layer++) {
            int radius = 12 - layer;
            for (int x = -radius; x <= radius; x++) {
                for (int z = -radius; z <= radius; z++) {
                    double distance = Math.sqrt(x * x + z * z);
                    if (distance <= radius && distance > radius - 1) {
                        Block roof = world.getBlockAt(cx + x, cy + mainHallHeight + layer, cz + z);
                        if (layer == roofHeight - 1) {
                            // Загнутые края (красная терракота)
                            roof.setType(Material.RED_TERRACOTTA);
                        } else {
                            roof.setType(Material.DARK_OAK_PLANKS);
                        }
                    }
                }
            }
        }
        
        // Библиотека - крыша
        int libHeight = 10;
        for (int layer = 0; layer < 5; layer++) {
            int startX = -25;
            int endX = -11;
            int startZ = -10;
            int endZ = 10;
            int radius = 1 + layer;
            for (int x = startX; x <= endX; x++) {
                for (int z = startZ; z <= endZ; z++) {
                    double distToEdge = Math.min(
                        Math.min(x - startX, endX - x),
                        Math.min(z - startZ, endZ - z)
                    );
                    if (distToEdge <= radius && distToEdge > radius - 1) {
                        world.getBlockAt(cx + x, cy + libHeight + layer, cz + z).setType(Material.DARK_OAK_PLANKS);
                    }
                }
            }
        }
        
        // Комната отдыха - крыша
        int loungeHeight = 8;
        for (int layer = 0; layer < 4; layer++) {
            int startX = 11;
            int endX = 25;
            int startZ = -10;
            int endZ = 10;
            int radius = 1 + layer;
            for (int x = startX; x <= endX; x++) {
                for (int z = startZ; z <= endZ; z++) {
                    double distToEdge = Math.min(
                        Math.min(x - startX, endX - x),
                        Math.min(z - startZ, endZ - z)
                    );
                    if (distToEdge <= radius && distToEdge > radius - 1) {
                        world.getBlockAt(cx + x, cy + loungeHeight + layer, cz + z).setType(Material.DARK_OAK_PLANKS);
                    }
                }
            }
        }
    }
    
    private static void buildDecorations(World world, int cx, int cy, int cz) {
        // Декоративные решётки и витражи
        // Окна с витражами (цветное стекло)
        for (int y = 3; y < 7; y++) {
            // Главный зал
            world.getBlockAt(cx - 10, cy + y, cz - 5).setType(Material.BLUE_STAINED_GLASS_PANE);
            world.getBlockAt(cx - 10, cy + y, cz).setType(Material.YELLOW_STAINED_GLASS_PANE);
            world.getBlockAt(cx - 10, cy + y, cz + 5).setType(Material.RED_STAINED_GLASS_PANE);
            world.getBlockAt(cx + 10, cy + y, cz - 5).setType(Material.BLUE_STAINED_GLASS_PANE);
            world.getBlockAt(cx + 10, cy + y, cz).setType(Material.YELLOW_STAINED_GLASS_PANE);
            world.getBlockAt(cx + 10, cy + y, cz + 5).setType(Material.RED_STAINED_GLASS_PANE);
        }
        
        // Декоративные решётки (заборы)
        for (int x = -8; x <= 8; x += 4) {
            for (int z = -8; z <= 8; z += 4) {
                if (x != 0 || z != 0) {
                    world.getBlockAt(cx + x, cy + 1, cz + z).setType(Material.OAK_FENCE);
                }
            }
        }
    }
    
    private static void setWallBlock(World world, int x, int y, int z, int currentY, int maxHeight) {
        Block block = world.getBlockAt(x, y, z);
        
        // Основание и верх - бревна
        if (currentY == 0 || currentY == maxHeight - 1) {
            block.setType(Material.DARK_OAK_LOG);
        }
        // Углы - бревна
        else if (Math.abs(x % 25) == 0 || Math.abs(z % 25) == 0) {
            block.setType(Material.DARK_OAK_LOG);
        }
        // Остальное - доски
        else {
            block.setType(Material.OAK_PLANKS);
        }
    }
}
