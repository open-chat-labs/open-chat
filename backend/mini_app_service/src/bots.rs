// The service's calls to bots: asking one to accept a player, and telling it one left
use crate::games::Game;
use crate::now_millis;
use crate::protocol::JoinResponse;
use crate::tokens::Tokens;
use async_trait::async_trait;
use std::sync::Arc;
use std::time::Duration;
use tracing::warn;
use types::{Error, UserId};

// How long a bot has to accept or refuse a player
const JOIN_TIMEOUT: Duration = Duration::from_secs(5);
// A bot's message refusing a player is shown to them, so it's kept short
const MAX_MESSAGE_CHARS: usize = 200;
const LEAVE_ATTEMPTS: u32 = 3;

#[derive(Debug, PartialEq, Eq)]
pub enum JoinOutcome {
    Accepted,
    Refused(Option<String>),
    // The bot didn't answer in time, or not as the protocol says
    Unavailable,
}

#[async_trait]
pub trait BotClient: Send + Sync {
    async fn join(&self, game: &Game, user_id: UserId) -> JoinOutcome;
    async fn leave(&self, game: &Game, user_id: UserId) -> Result<(), Error>;
}

pub struct HttpBotClient {
    http: reqwest::Client,
    tokens: Arc<Tokens>,
}

impl HttpBotClient {
    pub fn new(tokens: Arc<Tokens>) -> HttpBotClient {
        HttpBotClient {
            http: reqwest::Client::builder()
                .timeout(JOIN_TIMEOUT)
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
        let response = match self
            .http
            .post(url(&game.bot_endpoint, "join"))
            .header("x-oc-jwt", token)
            .send()
            .await
        {
            Ok(response) if response.status().is_success() => response,
            Ok(response) => {
                warn!(bot = %game.bot, status = %response.status(), "Bot refused a join request");
                return JoinOutcome::Unavailable;
            }
            Err(error) => {
                warn!(bot = %game.bot, %error, "Bot didn't answer a join request");
                return JoinOutcome::Unavailable;
            }
        };
        match response.json::<JoinResponse>().await {
            Ok(JoinResponse { accepted: true, .. }) => JoinOutcome::Accepted,
            Ok(JoinResponse { message, .. }) => {
                JoinOutcome::Refused(message.map(|m| m.chars().take(MAX_MESSAGE_CHARS).collect()))
            }
            Err(error) => {
                warn!(bot = %game.bot, %error, "Bot answered a join request with something unreadable");
                JoinOutcome::Unavailable
            }
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
