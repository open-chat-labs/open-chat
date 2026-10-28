// Where the service keeps its games, so a restart or a deploy doesn't end them
use crate::games::Game;
use async_trait::async_trait;
use redis::AsyncCommands;
use redis::aio::ConnectionManager;
use std::collections::HashMap;
use std::sync::Mutex;
use types::{Error, MiniAppGame, TimestampMillis};

#[async_trait]
pub trait Store: Send + Sync {
    async fn get(&self, game: &MiniAppGame) -> Result<Option<Game>, Error>;
    // Saves the game, and when its bot last updated it
    async fn put(&self, game: &Game) -> Result<(), Error>;
    async fn delete(&self, game: &MiniAppGame) -> Result<(), Error>;
    // The games whose bots haven't updated them since `before`
    async fn idle_since(&self, before: TimestampMillis) -> Result<Vec<MiniAppGame>, Error>;
}

// A game's key, which is also how it's listed by when its bot last updated it
fn key(game: &MiniAppGame) -> String {
    serde_json::to_string(game).expect("A game serializes")
}

const GAME_PREFIX: &str = "mini_app:game:";
const ACTIVITY_KEY: &str = "mini_app:activity";

pub struct RedisStore {
    connection: ConnectionManager,
}

impl RedisStore {
    pub async fn connect(url: &str) -> Result<RedisStore, Error> {
        let client = redis::Client::open(url)?;
        let connection = ConnectionManager::new(client).await?;
        Ok(RedisStore { connection })
    }
}

#[async_trait]
impl Store for RedisStore {
    async fn get(&self, game: &MiniAppGame) -> Result<Option<Game>, Error> {
        let json: Option<String> = self.connection.clone().get(format!("{GAME_PREFIX}{}", key(game))).await?;
        Ok(json.map(|json| serde_json::from_str(&json)).transpose()?)
    }

    async fn put(&self, game: &Game) -> Result<(), Error> {
        let key = key(&game.game);
        let json = serde_json::to_string(game)?;
        redis::pipe()
            .atomic()
            .set(format!("{GAME_PREFIX}{key}"), json)
            .zadd(ACTIVITY_KEY, &key, game.last_bot_update)
            .exec_async(&mut self.connection.clone())
            .await?;
        Ok(())
    }

    async fn delete(&self, game: &MiniAppGame) -> Result<(), Error> {
        let key = key(game);
        redis::pipe()
            .atomic()
            .del(format!("{GAME_PREFIX}{key}"))
            .zrem(ACTIVITY_KEY, &key)
            .exec_async(&mut self.connection.clone())
            .await?;
        Ok(())
    }

    async fn idle_since(&self, before: TimestampMillis) -> Result<Vec<MiniAppGame>, Error> {
        let keys: Vec<String> = self
            .connection
            .clone()
            .zrangebyscore(ACTIVITY_KEY, "-inf", format!("({before}"))
            .await?;
        keys.iter()
            .map(|key| serde_json::from_str(key).map_err(Error::from))
            .collect()
    }
}

// For tests, and for running without Redis, when games end with the process
#[derive(Default)]
pub struct MemoryStore {
    games: Mutex<HashMap<MiniAppGame, Game>>,
}

#[async_trait]
impl Store for MemoryStore {
    async fn get(&self, game: &MiniAppGame) -> Result<Option<Game>, Error> {
        Ok(self.games.lock().unwrap().get(game).cloned())
    }

    async fn put(&self, game: &Game) -> Result<(), Error> {
        self.games.lock().unwrap().insert(game.game, game.clone());
        Ok(())
    }

    async fn delete(&self, game: &MiniAppGame) -> Result<(), Error> {
        self.games.lock().unwrap().remove(game);
        Ok(())
    }

    async fn idle_since(&self, before: TimestampMillis) -> Result<Vec<MiniAppGame>, Error> {
        Ok(self
            .games
            .lock()
            .unwrap()
            .values()
            .filter(|game| game.last_bot_update < before)
            .map(|game| game.game)
            .collect())
    }
}
