// The service's calls to bots: asking one to accept a player, or to start a game, and telling it one left
use crate::games::Game;
use crate::now_millis;
use crate::protocol::{GameState, JoinResponse, StartResponse};
use crate::tokens::Tokens;
use async_trait::async_trait;
use serde::de::DeserializeOwned;
use std::sync::Arc;
use std::time::Duration;
use tracing::warn;
use types::{Error, UserId};

// How long a bot has to accept or refuse a player, or to start a game
const JOIN_TIMEOUT: Duration = Duration::from_secs(5);
// A bot's message refusing a player or a start is shown to them, so it's kept short
const MAX_MESSAGE_CHARS: usize = 200;
const LEAVE_ATTEMPTS: u32 = 3;

#[derive(Debug, PartialEq, Eq)]
pub enum JoinOutcome {
    Accepted,
    Refused(Option<String>),
    // The bot didn't answer in time, or not as the protocol says
    Unavailable,
}

#[derive(Debug, Clone, PartialEq)]
pub enum StartOutcome {
    Accepted(Started),
    Refused(Option<String>),
    // The bot didn't answer in time, or not as the protocol says
    Unavailable,
}

// What a bot started its game with
#[derive(Debug, Clone, PartialEq)]
pub struct Started {
    pub players: Vec<UserId>,
    pub waiting_for: Vec<UserId>,
    // The game's settings as the bot's JSON, serialized compactly, as the card records them
    pub settings: Option<String>,
    pub state: Option<GameState>,
}

#[async_trait]
pub trait BotClient: Send + Sync {
    async fn join(&self, game: &Game, user_id: UserId) -> JoinOutcome;
    async fn start(&self, game: &Game, user_id: UserId) -> StartOutcome;
    async fn leave(&self, game: &Game, user_id: UserId) -> Result<(), Error>;
}

pub struct HttpBotClient {
    http: reqwest::Client,
    tokens: Arc<Tokens>,
}

impl HttpBotClient {
    pub fn new(tokens: Arc<Tokens>) -> HttpBotClient {
        HttpBotClient {
            // A bot's endpoint can't redirect the service's calls elsewhere
            http: reqwest::Client::builder()
                .timeout(JOIN_TIMEOUT)
                .redirect(reqwest::redirect::Policy::none())
                .build()
                .expect("An HTTP client builds"),
            tokens,
        }
    }
}

#[async_trait]
impl BotClient for HttpBotClient {
    async fn join(&self, game: &Game, user_id: UserId) -> JoinOutcome {
        let token = self.tokens.join_call(game.bot, game.game, user_id, now_millis());
        match self.ask::<JoinResponse>(game, "join", token).await {
            Some(JoinResponse { accepted: true, .. }) => JoinOutcome::Accepted,
            Some(JoinResponse { message, .. }) => JoinOutcome::Refused(shorten(message)),
            None => JoinOutcome::Unavailable,
        }
    }

    async fn start(&self, game: &Game, user_id: UserId) -> StartOutcome {
        let token = self.tokens.start_call(game.bot, game.game, user_id, now_millis());
        match self.ask::<StartResponse>(game, "start", token).await {
            Some(StartResponse {
                accepted: true,
                players,
                waiting_for,
                settings,
                state,
                ..
            }) => StartOutcome::Accepted(Started {
                players,
                waiting_for,
                settings: settings.map(|settings| settings.to_string()),
                state,
            }),
            Some(StartResponse { message, .. }) => StartOutcome::Refused(shorten(message)),
            None => StartOutcome::Unavailable,
        }
    }

    // Tried a few times, as the bot's player list should match the service's
    async fn leave(&self, game: &Game, user_id: UserId) -> Result<(), Error> {
        let mut delay = Duration::from_secs(1);
        let mut attempt = 1;
        loop {
            let token = self.tokens.leave_call(game.bot, game.game, user_id, now_millis());
            let error = match self
                .http
                .post(url(&game.bot_endpoint, "leave"))
                .header("x-oc-jwt", token)
                .send()
                .await
            {
                Ok(response) if response.status().is_success() => return Ok(()),
                Ok(response) => format!("Status {}", response.status()),
                Err(error) => error.to_string(),
            };
            if attempt == LEAVE_ATTEMPTS {
                return Err(error.into());
            }
            attempt += 1;
            tokio::time::sleep(delay).await;
            delay *= 2;
        }
    }
}

impl HttpBotClient {
    // A call the bot answers, or none if it didn't answer in time, or as the protocol says
    async fn ask<T: DeserializeOwned>(&self, game: &Game, call: &str, token: String) -> Option<T> {
        let response = match self
            .http
            .post(url(&game.bot_endpoint, call))
            .header("x-oc-jwt", token)
            .send()
            .await
        {
            Ok(response) if response.status().is_success() => response,
            Ok(response) => {
                warn!(bot = %game.bot, call, status = %response.status(), "Bot refused a call");
                return None;
            }
            Err(error) => {
                warn!(bot = %game.bot, call, %error, "Bot didn't answer a call");
                return None;
            }
        };
        match response.json::<T>().await {
            Ok(answer) => Some(answer),
            Err(error) => {
                warn!(bot = %game.bot, call, %error, "Bot answered a call with something unreadable");
                None
            }
        }
    }
}

fn shorten(message: Option<String>) -> Option<String> {
    message.map(|m| m.chars().take(MAX_MESSAGE_CHARS).collect())
}

fn url(endpoint: &str, call: &str) -> String {
    format!("{}/mini_app/{call}", endpoint.trim_end_matches('/'))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn calls_go_to_the_bots_endpoint() {
        assert_eq!(
            url("https://uno.example.com/", "join"),
            "https://uno.example.com/mini_app/join"
        );
        assert_eq!(url("http://localhost:3100", "leave"), "http://localhost:3100/mini_app/leave");
    }
}
