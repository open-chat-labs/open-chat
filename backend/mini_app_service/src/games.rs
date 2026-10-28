// A game as the service keeps it, and the rules for changing it
use crate::protocol::{Card, GameState, GameStatus, Refusal};
use serde::{Deserialize, Serialize};
use types::{
    CanisterId, MiniAppActive, MiniAppFinished, MiniAppGame, MiniAppRegistrationClaims, MiniAppStatus, TimestampMillis, UserId,
};

pub const MAX_RESULT_CHARS: usize = 200;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Game {
    pub game: MiniAppGame,
    pub bot: UserId,
    // Where join requests go, as the bot was registered when it posted the game
    pub bot_endpoint: String,
    // The LocalUserIndex the game's card is written through
    pub bot_api_gateway: CanisterId,
    pub max_players: Option<u32>,
    pub spectators: bool,
    pub status: GameStatus,
    // Who's joined, in the order they did, while the game's taking players, then who's playing
    pub players: Vec<UserId>,
    // Who the game started with, which its card records
    #[serde(default)]
    pub started_with: Vec<UserId>,
    pub result: Option<String>,
    // When the bot last updated the game, or registered it
    pub last_bot_update: TimestampMillis,
    pub state: Option<GameState>,
}

// What a bot's update changes
#[derive(Debug, Default, PartialEq)]
pub struct Applied {
    // The players, status or result changed, so the live card did
    pub card_changed: bool,
    // The game started or finished, so the card in the chat must be written
    pub write_card: bool,
    // A newer state, for everyone with the game open
    pub new_state: bool,
}

#[derive(Debug, PartialEq, Eq)]
pub enum UpdateError {
    // The game has finished, so nothing changes it
    Finished,
    Invalid(String),
}

impl Game {
    pub fn register(claims: MiniAppRegistrationClaims, now: TimestampMillis) -> Game {
        Game {
            game: claims.game,
            bot: claims.bot,
            bot_endpoint: claims.bot_endpoint,
            bot_api_gateway: claims.bot_api_gateway,
            max_players: claims.max_players,
            spectators: claims.spectators,
            status: GameStatus::Open,
            players: Vec::new(),
            started_with: Vec::new(),
            result: None,
            last_bot_update: now,
            state: None,
        }
    }

    pub fn is_player(&self, user_id: UserId) -> bool {
        self.players.contains(&user_id)
    }

    fn is_full(&self) -> bool {
        self.max_players.is_some_and(|max| self.players.len() >= max as usize)
    }

    // Whether a user can join, before the bot's asked
    pub fn can_join(&self) -> Result<(), Refusal> {
        if self.status != GameStatus::Open {
            Err(Refusal::NotOpen)
        } else if self.is_full() {
            Err(Refusal::Full)
        } else {
            Ok(())
        }
    }

    // Adds a player the bot accepted, unless the game started or filled up while it was asked
    pub fn add_player(&mut self, user_id: UserId) -> Result<(), Refusal> {
        if self.is_player(user_id) {
            return Ok(());
        }
        self.can_join()?;
        self.players.push(user_id);
        Ok(())
    }

    // A player leaving while the game's taking players
    pub fn leave(&mut self, user_id: UserId) -> Result<bool, Refusal> {
        if self.status != GameStatus::Open {
            return Err(Refusal::NotOpen);
        }
        let before = self.players.len();
        self.players.retain(|p| *p != user_id);
        Ok(self.players.len() < before)
    }

    // The bot's update: its status only moves forward, a result only comes with Finished, and a state
    // older than the latest is dropped. Nothing changes if any of it is invalid.
    pub fn apply(
        &mut self,
        status: Option<GameStatus>,
        result: Option<String>,
        remove: &[UserId],
        state: Option<GameState>,
        now: TimestampMillis,
    ) -> Result<Applied, UpdateError> {
        if self.status == GameStatus::Finished {
            return Err(UpdateError::Finished);
        }
        let status = status.unwrap_or(self.status);
        if status < self.status {
            return Err(UpdateError::Invalid("A game's status only moves forward".to_string()));
        }
        if let Some(result) = &result {
            if status != GameStatus::Finished {
                return Err(UpdateError::Invalid("Only a finished game has a result".to_string()));
            }
            if result.trim().is_empty() || result.chars().count() > MAX_RESULT_CHARS {
                return Err(UpdateError::Invalid(format!(
                    "A result has 1 to {MAX_RESULT_CHARS} characters"
                )));
            }
        }

        let mut applied = Applied::default();
        if !remove.is_empty() {
            let before = self.players.len();
            self.players.retain(|p| !remove.contains(p));
            applied.card_changed |= self.players.len() < before;
        }
        if status != self.status {
            if status == GameStatus::Active {
                self.started_with = self.players.clone();
            }
            self.status = status;
            applied.card_changed = true;
            applied.write_card = true;
        }
        if result.is_some() {
            self.result = result;
            applied.card_changed = true;
        }
        if let Some(state) = state
            && self.state.as_ref().is_none_or(|current| state.seq > current.seq)
        {
            self.state = Some(state);
            applied.new_state = true;
        }
        self.last_bot_update = now;
        Ok(applied)
    }

    // Ends a game its bot stopped updating, or was uninstalled from the chat
    pub fn abandon(&mut self) {
        self.status = GameStatus::Finished;
        self.result = None;
    }

    pub fn card(&self, watching: u32) -> Card {
        Card {
            game: self.game,
            status: self.status,
            players: self.players.clone(),
            watching,
            result: self.result.clone(),
        }
    }

    // The status the card in the chat holds: the players the game started with, then its result
    pub fn card_status(&self) -> MiniAppStatus {
        match self.status {
            GameStatus::Open => MiniAppStatus::Open,
            GameStatus::Active => MiniAppStatus::Active(MiniAppActive {
                players: self.started_with.clone(),
            }),
            GameStatus::Finished => MiniAppStatus::Finished(MiniAppFinished {
                players: self.started_with.clone(),
                result: self.result.clone(),
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use serde_json::json;
    use std::collections::HashMap;
    use types::Chat;

    fn user(n: u8) -> UserId {
        Principal::from_slice(&[n]).into()
    }

    fn game(max_players: Option<u32>) -> Game {
        Game::register(
            MiniAppRegistrationClaims {
                bot: user(100),
                bot_endpoint: "https://uno.example.com".to_string(),
                bot_api_gateway: Principal::from_slice(&[200]),
                game: MiniAppGame {
                    chat: Chat::Group(Principal::from_slice(&[201]).into()),
                    thread: None,
                    message_id: 7u64.into(),
                },
                max_players,
                spectators: true,
            },
            0,
        )
    }

    fn state(seq: u64) -> GameState {
        GameState {
            seq,
            shared: json!({ "seq": seq }),
            private: HashMap::new(),
        }
    }

    #[test]
    fn players_join_until_its_full_or_started() {
        let mut game = game(Some(2));
        game.add_player(user(1)).unwrap();
        game.add_player(user(1)).unwrap();
        game.add_player(user(2)).unwrap();
        assert_eq!(game.players, vec![user(1), user(2)]);
        assert_eq!(game.add_player(user(3)), Err(Refusal::Full));

        let mut game = self::game(None);
        game.add_player(user(1)).unwrap();
        game.apply(Some(GameStatus::Active), None, &[], None, 1).unwrap();
        assert_eq!(game.can_join(), Err(Refusal::NotOpen));
        assert_eq!(game.add_player(user(2)), Err(Refusal::NotOpen));
    }

    #[test]
    fn a_player_leaves_only_while_its_taking_players() {
        let mut game = game(None);
        game.add_player(user(1)).unwrap();
        assert_eq!(game.leave(user(2)), Ok(false));
        assert_eq!(game.leave(user(1)), Ok(true));

        game.add_player(user(1)).unwrap();
        game.apply(Some(GameStatus::Active), None, &[], None, 1).unwrap();
        assert_eq!(game.leave(user(1)), Err(Refusal::NotOpen));
    }

    // The card in the chat is written when the game starts, with its players, and when it finishes,
    // with the same players and its result
    #[test]
    fn the_game_starts_then_finishes_with_its_players() {
        let mut game = game(None);
        game.add_player(user(1)).unwrap();
        game.add_player(user(2)).unwrap();
        assert_eq!(game.card_status(), MiniAppStatus::Open);

        let applied = game.apply(Some(GameStatus::Active), None, &[], None, 1).unwrap();
        assert!(applied.card_changed && applied.write_card);
        assert_eq!(
            game.card_status(),
            MiniAppStatus::Active(MiniAppActive {
                players: vec![user(1), user(2)]
            })
        );

        // A player knocked out leaves the live card, but not the one in the chat
        let applied = game.apply(None, None, &[user(2)], None, 2).unwrap();
        assert!(applied.card_changed && !applied.write_card);
        assert_eq!(game.players, vec![user(1)]);

        let applied = game
            .apply(Some(GameStatus::Finished), Some("Alice won".to_string()), &[], None, 3)
            .unwrap();
        assert!(applied.write_card);
        assert_eq!(
            game.card_status(),
            MiniAppStatus::Finished(MiniAppFinished {
                players: vec![user(1), user(2)],
                result: Some("Alice won".to_string()),
            })
        );
        assert_eq!(game.apply(None, None, &[], Some(state(1)), 4), Err(UpdateError::Finished));
    }

    #[test]
    fn a_bots_update_is_valid_or_changes_nothing() {
        let mut game = game(None);
        game.add_player(user(1)).unwrap();
        game.apply(Some(GameStatus::Active), None, &[], None, 1).unwrap();
        let before = game.clone();

        for (status, result) in [
            (Some(GameStatus::Open), None),
            (None, Some("Bob won".to_string())),
            (Some(GameStatus::Finished), Some(" ".to_string())),
            (Some(GameStatus::Finished), Some("x".repeat(MAX_RESULT_CHARS + 1))),
        ] {
            assert!(matches!(
                game.apply(status, result, &[user(1)], Some(state(5)), 9),
                Err(UpdateError::Invalid(_))
            ));
            assert_eq!(game, before);
        }
    }

    // States can arrive out of order, so an older one than the latest is dropped
    #[test]
    fn only_a_newer_state_replaces_the_latest() {
        let mut game = game(None);
        assert!(game.apply(None, None, &[], Some(state(2)), 1).unwrap().new_state);
        assert!(!game.apply(None, None, &[], Some(state(1)), 2).unwrap().new_state);
        assert!(!game.apply(None, None, &[], Some(state(2)), 3).unwrap().new_state);
        assert_eq!(game.state, Some(state(2)));
        assert_eq!(game.last_bot_update, 3);
    }

    #[test]
    fn an_abandoned_game_finishes_with_whoever_it_started_with() {
        let mut game = game(None);
        game.add_player(user(1)).unwrap();
        game.abandon();
        assert_eq!(
            game.card_status(),
            MiniAppStatus::Finished(MiniAppFinished {
                players: Vec::new(),
                result: None,
            })
        );
    }
}
