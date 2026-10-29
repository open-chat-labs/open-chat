// Where the service keeps its games, so a restart or a deploy doesn't end them
use crate::games::Game;
use async_trait::async_trait;
use redis::AsyncCommands;
use redis::aio::ConnectionManager;
use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use types::{Error, MiniAppGame};

// An ended game is remembered for longer than a registration lasts, so a bot registering it again
// doesn't bring it back
const ENDED_SECONDS: u64 = 2 * 60 * 60;

#[async_trait]
pub trait Store: Send + Sync {
    async fn get(&self, game: &MiniAppGame) -> Result<Option<Game>, Error>;
    async fn put(&self, game: &Game) -> Result<(), Error>;
    // Forgets the game, remembering it ended
    async fn end(&self, game: &MiniAppGame) -> Result<(), Error>;
    // Forgets a game whose card was never posted
    async fn forget(&self, game: &MiniAppGame) -> Result<(), Error>;
    async fn has_ended(&self, game: &MiniAppGame) -> Result<bool, Error>;
    async fn all(&self) -> Result<Vec<MiniAppGame>, Error>;
}

// A game's key, which is also how it's listed
fn key(game: &MiniAppGame) -> String {
    serde_json::to_string(game).expect("A game serializes")
}

const GAME_PREFIX: &str = "mini_app:game:";
const ENDED_PREFIX: &str = "mini_app:ended:";
const GAMES_KEY: &str = "mini_app:games";

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
            .sadd(GAMES_KEY, &key)
            .exec_async(&mut self.connection.clone())
            .await?;
        Ok(())
    }

    async fn end(&self, game: &MiniAppGame) -> Result<(), Error> {
        let key = key(game);
        redis::pipe()
            .atomic()
            .del(format!("{GAME_PREFIX}{key}"))
            .srem(GAMES_KEY, &key)
            .set_ex(format!("{ENDED_PREFIX}{key}"), 1, ENDED_SECONDS)
            .exec_async(&mut self.connection.clone())
            .await?;
        Ok(())
    }

    async fn forget(&self, game: &MiniAppGame) -> Result<(), Error> {
        let key = key(game);
        redis::pipe()
            .atomic()
            .del(format!("{GAME_PREFIX}{key}"))
            .srem(GAMES_KEY, &key)
            .exec_async(&mut self.connection.clone())
            .await?;
        Ok(())
    }

    async fn has_ended(&self, game: &MiniAppGame) -> Result<bool, Error> {
        Ok(self.connection.clone().exists(format!("{ENDED_PREFIX}{}", key(game))).await?)
    }

    async fn all(&self) -> Result<Vec<MiniAppGame>, Error> {
        let keys: Vec<String> = self.connection.clone().smembers(GAMES_KEY).await?;
        keys.iter()
            .map(|key| serde_json::from_str(key).map_err(Error::from))
            .collect()
    }
}

// For tests, and for running without Redis, when games end with the process
#[derive(Default)]
pub struct MemoryStore {
    games: Mutex<HashMap<MiniAppGame, Game>>,
    ended: Mutex<HashSet<MiniAppGame>>,
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

    async fn end(&self, game: &MiniAppGame) -> Result<(), Error> {
        self.games.lock().unwrap().remove(game);
        self.ended.lock().unwrap().insert(*game);
        Ok(())
    }

    async fn forget(&self, game: &MiniAppGame) -> Result<(), Error> {
        self.games.lock().unwrap().remove(game);
        Ok(())
    }

    async fn has_ended(&self, game: &MiniAppGame) -> Result<bool, Error> {
        Ok(self.ended.lock().unwrap().contains(game))
    }

    async fn all(&self) -> Result<Vec<MiniAppGame>, Error> {
        Ok(self.games.lock().unwrap().keys().copied().collect())
    }
}
