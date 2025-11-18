-- Создание таблицы игроков Minecraft
CREATE TABLE IF NOT EXISTS minecraft_players (
    id SERIAL PRIMARY KEY,
    username VARCHAR(16) NOT NULL,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_playtime INTEGER DEFAULT 0, -- в секундах
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создание индекса для быстрого поиска по username
CREATE INDEX IF NOT EXISTS idx_minecraft_players_username ON minecraft_players(username);

-- Создание индекса для быстрого поиска по uuid
CREATE INDEX IF NOT EXISTS idx_minecraft_players_uuid ON minecraft_players(uuid);

-- Создание индекса для быстрого поиска по дате последнего визита
CREATE INDEX IF NOT EXISTS idx_minecraft_players_last_seen ON minecraft_players(last_seen);

