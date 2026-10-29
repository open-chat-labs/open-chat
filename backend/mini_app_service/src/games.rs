// A game as the service keeps it, and the rules for changing it
use crate::bots::Started;
use crate::protocol::{Card, GameState, GameStatus, PostArgs, Refusal};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use types::{
    CanisterId, MiniAppActive, MiniAppContent, MiniAppEnded, MiniAppFinished, MiniAppGame, MiniAppPostClaims, MiniAppStarted,
    MiniAppStatus, MiniAppStatusUpdate, MiniAppTurn, TimestampMillis, UserId,
};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Game {
    pub game: MiniAppGame,
    pub bot: UserId,
    // Where join requests go, as the bot was registered when it posted the game
    pub bot_endpoint: String,
    // The LocalUserIndex the game's card is posted and written through
    pub bot_api_gateway: CanisterId,
    // The post the card is being made with, until OpenChat has taken it. Until then the game is
    // unknown to everyone, and the post is sent again if it failed or was cut off.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pending_post: Option<PostArgs>,
    pub max_players: Option<u32>,
    pub spectators: bool,
    pub status: GameStatus,
    // Who's joined, in the order they did, while the game's taking players, then who's playing
    pub players: Vec<UserId>,
    // Who the game started with, which its card records
    pub started_with: Vec<UserId>,
    // Whose turn it is, as the bot last said
    pub waiting_for: Vec<UserId>,
    pub result: Option<String>,
    // When the bot last updated the game, or registered it
    pub last_bot_update: TimestampMillis,
    pub state: Option<GameState>,
    // What the card in the chat holds, as the service last wrote it
    pub card: MiniAppStatus,
    // The bot was uninstalled from the chat, after which only ending the game goes through
    pub bot_uninstalled: bool,
}

// What a bot's update changes
#[derive(Debug, Default, PartialEq)]
pub struct Applied {
    // The players, status, turn or result changed, so the live card did
    pub card_changed: bool,
    // The game started or finished, or its turn passed, so the card in the chat needs writing
    pub write_card: bool,
    // A newer state, for everyone with the game open
    pub new_state: bool,
}

// Who a game's start took off and put on, who the bot gave who didn't join, and whether it came with a
// state
#[derive(Debug, PartialEq, Eq)]
pub struct StartChanges {
    pub removed: Vec<UserId>,
    pub added: Vec<UserId>,
    pub not_joined: Vec<UserId>,
    pub new_state: bool,
}

#[derive(Debug, PartialEq, Eq)]
pub enum UpdateError {
    // The game has finished, so nothing changes it
    Finished,
    Invalid(String),
}

// A bot's update, as its fields arrive
#[derive(Debug, Default)]
pub struct BotUpdate {
    pub status: Option<GameStatus>,
    pub waiting_for: Option<Vec<UserId>>,
    pub result: Option<String>,
    pub remove: Vec<UserId>,
    pub state: Option<GameState>,
}

impl Game {
    // A game whose card is being posted, with the bot's post token
    pub fn posting(claims: MiniAppPostClaims, post: PostArgs, now: TimestampMillis) -> Game {
        Game {
            game: claims.game,
            bot: claims.bot,
            bot_endpoint: claims.bot_endpoint,
            bot_api_gateway: claims.bot_api_gateway,
            max_players: post.card.max_players,
            spectators: post.card.spectators,
            pending_post: Some(post),
            status: GameStatus::Open,
            players: Vec::new(),
            started_with: Vec::new(),
            waiting_for: Vec::new(),
            result: None,
            last_bot_update: now,
            state: None,
            card: MiniAppStatus::Open,
            bot_uninstalled: false,
        }
    }

    // Whether OpenChat has taken the card, before which no one knows the game
    pub fn is_posted(&self) -> bool {
        self.pending_post.is_none()
    }

    pub fn is_player(&self, user_id: UserId) -> bool {
        self.players.contains(&user_id)
    }

    // A card holds at most `MiniAppContent::MAX_PLAYERS`, whatever the game's limit
    fn limit(&self) -> usize {
        self.max_players.map_or(MiniAppContent::MAX_PLAYERS, |max| {
            (max as usize).min(MiniAppContent::MAX_PLAYERS)
        })
    }

    fn is_full(&self) -> bool {
        self.players.len() >= self.limit()
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

    // The bot's update: its status only moves forward, it only waits for players, a result only comes
    // with Finished, and a state older than the latest is dropped. Nothing changes if any of it is
    // invalid.
    pub fn apply(&mut self, update: BotUpdate, now: TimestampMillis) -> Result<Applied, UpdateError> {
        if self.status == GameStatus::Finished {
            return Err(UpdateError::Finished);
        }
        // A player starts a game, through the service, so a bot only ends one
        if update.status.is_some_and(|status| status != GameStatus::Finished) {
            return Err(UpdateError::Invalid("A bot only sets a game Finished".to_string()));
        }
        let status = update.status.unwrap_or(self.status);
        if let Some(waiting_for) = &update.waiting_for {
            let players: Vec<_> = self.players.iter().filter(|p| !update.remove.contains(p)).copied().collect();
            check_waiting_for(waiting_for, &players).map_err(UpdateError::Invalid)?;
        }
        if let Some(result) = &update.result {
            if status != GameStatus::Finished {
                return Err(UpdateError::Invalid("Only a finished game has a result".to_string()));
            }
            if result.trim().is_empty() || result.chars().count() > MiniAppContent::MAX_RESULT_CHARS {
                return Err(UpdateError::Invalid(format!(
                    "A result has 1 to {} characters",
                    MiniAppContent::MAX_RESULT_CHARS
                )));
            }
        }

        let mut applied = Applied::default();
        if !update.remove.is_empty() {
            let before = self.players.len();
            self.players.retain(|p| !update.remove.contains(p));
            self.waiting_for.retain(|p| !update.remove.contains(p));
            applied.card_changed |= self.players.len() < before;
        }
        if let Some(waiting_for) = update.waiting_for
            && waiting_for != self.waiting_for
        {
            self.waiting_for = waiting_for;
            applied.card_changed = true;
            applied.write_card = true;
        }
        if status != self.status {
            if status == GameStatus::Finished {
                self.waiting_for.clear();
            }
            self.status = status;
            applied.card_changed = true;
            applied.write_card = true;
        }
        if update.result.is_some() {
            self.result = update.result;
            applied.card_changed = true;
        }
        if let Some(state) = update.state
            && self.state.as_ref().is_none_or(|current| state.seq > current.seq)
        {
            self.state = Some(state);
            applied.new_state = true;
        }
        self.last_bot_update = now;
        Ok(applied)
    }

    // The bot's answer to a player starting the game: it plays with the players the bot gives, in the
    // order they joined. Each must be playing, or still `joining`, having asked to join through OpenChat
    // and been accepted by the bot as it answered. Anyone else it gives isn't added, eg. a player whose
    // leave hasn't reached the bot yet, and the bot's told they left. Anyone playing whom it leaves out
    // is taken off. An answer which is invalid in itself changes nothing.
    pub fn start(&mut self, mut started: Started, joining: &[UserId], now: TimestampMillis) -> Result<StartChanges, String> {
        if self.status != GameStatus::Open {
            return Err("The game has already started".to_string());
        }
        if started.players.iter().collect::<HashSet<_>>().len() < started.players.len() {
            return Err("A player is listed twice".to_string());
        }
        if started.players.len() > self.limit() {
            return Err(format!("This game has at most {} players", self.limit()));
        }
        check_waiting_for(&started.waiting_for, &started.players)?;
        if let (Some(state), Some(current)) = (&started.state, &self.state)
            && state.seq <= current.seq
        {
            return Err("The first state's seq must be above the last state's".to_string());
        }
        let not_joined: Vec<_> = started
            .players
            .iter()
            .filter(|user_id| !self.players.contains(user_id) && !joining.contains(user_id))
            .copied()
            .collect();
        started.players.retain(|user_id| !not_joined.contains(user_id));
        started.waiting_for.retain(|user_id| !not_joined.contains(user_id));
        if started.players.is_empty() {
            return Err("A game starts with a player at least".to_string());
        }

        let removed: Vec<_> = self
            .players
            .iter()
            .filter(|user_id| !started.players.contains(user_id))
            .copied()
            .collect();
        let added: Vec<_> = started
            .players
            .iter()
            .filter(|user_id| !self.players.contains(user_id))
            .copied()
            .collect();
        self.players.retain(|user_id| started.players.contains(user_id));
        self.players.extend(added.iter().copied());
        self.started_with = self.players.clone();
        self.waiting_for = started.waiting_for;
        self.status = GameStatus::Active;
        let new_state = started.state.is_some();
        if started.state.is_some() {
            self.state = started.state;
        }
        self.last_bot_update = now;
        Ok(StartChanges {
            removed,
            added,
            not_joined,
            new_state,
        })
    }

    // Ends a game its bot stopped updating, or was uninstalled from the chat. A result the bot gave is
    // kept.
    pub fn abandon(&mut self) {
        if self.status != GameStatus::Finished {
            self.status = GameStatus::Finished;
            self.result = None;
            self.waiting_for.clear();
        }
    }

    pub fn card(&self, watching: u32) -> Card {
        Card {
            game: self.game,
            status: self.status,
            players: self.players.clone(),
            waiting_for: self.waiting_for.clone(),
            watching,
            result: self.result.clone(),
        }
    }

    // The update the card in the chat needs next, to catch up with the game: the game starting with
    // its players, whose turn it now is, or its ending. Nothing's written while the game's taking
    // players.
    pub fn next_card_update(&self) -> Option<MiniAppStatusUpdate> {
        let started = || {
            MiniAppStatusUpdate::Started(MiniAppStarted {
                players: self.started_with.clone(),
                waiting_for: self.card_waiting_for(),
            })
        };
        match (&self.card, self.status) {
            (MiniAppStatus::Finished(_), _) | (_, GameStatus::Open) => None,
            (MiniAppStatus::Open, GameStatus::Active) => Some(started()),
            (MiniAppStatus::Active(active), GameStatus::Active) => (active.waiting_for != self.card_waiting_for()).then(|| {
                MiniAppStatusUpdate::Turn(MiniAppTurn {
                    waiting_for: self.card_waiting_for(),
                })
            }),
            // The card records who played before it records the result, unless the bot's been
            // uninstalled, when only ending the game goes through
            (MiniAppStatus::Open, GameStatus::Finished) if !self.started_with.is_empty() && !self.bot_uninstalled => {
                Some(started())
            }
            (_, GameStatus::Finished) => Some(MiniAppStatusUpdate::Ended(MiniAppEnded {
                result: self.result.clone(),
            })),
        }
    }

    // The card in the chat took the update, so holds what it leaves, as the canister has it
    pub fn card_updated(&mut self, update: &MiniAppStatusUpdate) {
        self.card = match update {
            MiniAppStatusUpdate::Started(started) => MiniAppStatus::Active(MiniAppActive {
                players: started.players.clone(),
                waiting_for: started.waiting_for.clone(),
            }),
            MiniAppStatusUpdate::Turn(turn) => match &self.card {
                MiniAppStatus::Active(active) => MiniAppStatus::Active(MiniAppActive {
                    players: active.players.clone(),
                    waiting_for: turn.waiting_for.clone(),
                }),
                card => card.clone(),
            },
            MiniAppStatusUpdate::Ended(ended) => MiniAppStatus::Finished(MiniAppFinished {
                players: self.card.players().to_vec(),
                result: ended.result.clone(),
            }),
        };
    }

    // The game's over and its card says so, so the service can forget it
    pub fn is_done(&self) -> bool {
        self.status == GameStatus::Finished && matches!(self.card, MiniAppStatus::Finished(_))
    }

    // Whose turn the card shows: only players the game started with, whom the card lists
    fn card_waiting_for(&self) -> Vec<UserId> {
        self.waiting_for
            .iter()
            .filter(|user_id| self.started_with.contains(user_id))
            .copied()
            .collect()
    }
}

// Whose turn it is: some of the players, each once
fn check_waiting_for(waiting_for: &[UserId], players: &[UserId]) -> Result<(), String> {
    if waiting_for.iter().any(|user_id| !players.contains(user_id)) {
        return Err("Only players can be waited for".to_string());
    }
    if waiting_for.iter().collect::<HashSet<_>>().len() < waiting_for.len() {
        return Err("A player is waited for twice".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::CardContent;
    use candid::Principal;
    use serde_json::json;
    use std::collections::HashMap;
    use types::{BotInitiator, Chat};

    fn user(n: u8) -> UserId {
        Principal::from_slice(&[n]).into()
    }

    // A posted game
    fn game(max_players: Option<u32>) -> Game {
        let mut game = Game::posting(
            MiniAppPostClaims {
                bot: user(100),
                bot_endpoint: "https://uno.example.com".to_string(),
                bot_api_gateway: Principal::from_slice(&[200]),
                game: MiniAppGame {
                    chat: Chat::Group(Principal::from_slice(&[201]).into()),
                    thread: None,
                    message_id: 7u64.into(),
                },
                initiator: BotInitiator::Autonomous,
            },
            PostArgs {
                token: "token".to_string(),
                card: CardContent {
                    text: "Uno".to_string(),
                    image: None,
                    max_players,
                    spectators: true,
                },
                block_level_markdown: false,
                replies_to: None,
            },
            0,
        );
        assert!(!game.is_posted());
        game.pending_post = None;
        game
    }

    fn state(seq: u64) -> GameState {
        GameState {
            seq,
            shared: json!({ "seq": seq }),
            private: HashMap::new(),
        }
    }

    // A player starts it, and the bot with its players
    fn start(game: &mut Game) {
        let started = Started {
            players: game.players.clone(),
            waiting_for: Vec::new(),
            state: None,
        };
        game.start(started, &[], 1).unwrap();
    }

    fn status(status: GameStatus) -> BotUpdate {
        BotUpdate {
            status: Some(status),
            ..Default::default()
        }
    }

    // Writes whatever the card needs next until it's caught up, as the service does
    fn catch_up(game: &mut Game) -> Vec<MiniAppStatusUpdate> {
        let mut written = Vec::new();
        while let Some(update) = game.next_card_update() {
            game.card_updated(&update);
            written.push(update);
        }
        written
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
        start(&mut game);
        assert_eq!(game.can_join(), Err(Refusal::NotOpen));
        assert_eq!(game.add_player(user(2)), Err(Refusal::NotOpen));
    }

    // As many as a card can hold, whatever the game's limit
    #[test]
    fn a_game_without_a_limit_takes_as_many_as_a_card_holds() {
        for max_players in [None, Some(500)] {
            let mut game = game(max_players);
            for n in 0..MiniAppContent::MAX_PLAYERS {
                game.add_player(Principal::from_slice(&(n as u32).to_be_bytes()).into())
                    .unwrap();
            }
            assert_eq!(game.add_player(user(255)), Err(Refusal::Full));
        }
    }

    #[test]
    fn a_player_leaves_only_while_its_taking_players() {
        let mut game = game(None);
        game.add_player(user(1)).unwrap();
        assert_eq!(game.leave(user(2)), Ok(false));
        assert_eq!(game.leave(user(1)), Ok(true));

        game.add_player(user(1)).unwrap();
        start(&mut game);
        assert_eq!(game.leave(user(1)), Err(Refusal::NotOpen));
    }

    // The card in the chat is written when the game starts, with its players and whose turn it is, as
    // each turn passes, and when it ends
    #[test]
    fn the_card_follows_the_game_from_its_start_to_its_end() {
        let mut game = game(None);
        game.add_player(user(1)).unwrap();
        game.add_player(user(2)).unwrap();
        assert!(catch_up(&mut game).is_empty());

        game.start(
            Started {
                players: game.players.clone(),
                waiting_for: vec![user(1)],
                state: None,
            },
            &[],
            1,
        )
        .unwrap();
        assert_eq!(
            catch_up(&mut game),
            vec![MiniAppStatusUpdate::Started(MiniAppStarted {
                players: vec![user(1), user(2)],
                waiting_for: vec![user(1)],
            })]
        );

        game.apply(
            BotUpdate {
                waiting_for: Some(vec![user(2)]),
                ..Default::default()
            },
            2,
        )
        .unwrap();
        assert_eq!(
            catch_up(&mut game),
            vec![MiniAppStatusUpdate::Turn(MiniAppTurn {
                waiting_for: vec![user(2)]
            })]
        );

        // A player knocked out leaves the live card, but not the one in the chat, and isn't waited for
        let applied = game
            .apply(
                BotUpdate {
                    remove: vec![user(2)],
                    ..Default::default()
                },
                3,
            )
            .unwrap();
        assert!(applied.card_changed);
        assert_eq!(game.players, vec![user(1)]);
        assert_eq!(
            catch_up(&mut game),
            vec![MiniAppStatusUpdate::Turn(MiniAppTurn { waiting_for: vec![] })]
        );

        game.apply(
            BotUpdate {
                status: Some(GameStatus::Finished),
                result: Some("Alice won".to_string()),
                ..Default::default()
            },
            4,
        )
        .unwrap();
        assert_eq!(
            catch_up(&mut game),
            vec![MiniAppStatusUpdate::Ended(MiniAppEnded {
                result: Some("Alice won".to_string())
            })]
        );
        assert!(game.is_done());
        assert_eq!(
            game.card,
            MiniAppStatus::Finished(MiniAppFinished {
                players: vec![user(1), user(2)],
                result: Some("Alice won".to_string()),
            })
        );
        assert_eq!(game.apply(BotUpdate::default(), 5), Err(UpdateError::Finished));
    }

    // Its start, if it was never written, is written before its end, so the card records who played
    #[test]
    fn a_game_which_finishes_before_its_start_is_written_records_its_players() {
        let mut game = game(None);
        game.add_player(user(1)).unwrap();
        start(&mut game);
        game.apply(status(GameStatus::Finished), 2).unwrap();

        let written = catch_up(&mut game);
        assert!(matches!(written[0], MiniAppStatusUpdate::Started(_)));
        assert!(matches!(written[1], MiniAppStatusUpdate::Ended(_)));
        assert_eq!(game.card.players(), [user(1)]);
    }

    // Only ending the game goes through then, so the card ends with no one
    #[test]
    fn a_game_whose_bot_was_uninstalled_just_ends() {
        let mut game = game(None);
        game.add_player(user(1)).unwrap();
        start(&mut game);
        game.bot_uninstalled = true;
        game.abandon();

        assert_eq!(
            catch_up(&mut game),
            vec![MiniAppStatusUpdate::Ended(MiniAppEnded { result: None })]
        );
    }

    #[test]
    fn a_bots_update_is_valid_or_changes_nothing() {
        let mut game = game(None);
        game.add_player(user(1)).unwrap();
        start(&mut game);
        let before = game.clone();

        for update in [
            status(GameStatus::Open),
            BotUpdate {
                result: Some("Bob won".to_string()),
                ..Default::default()
            },
            BotUpdate {
                status: Some(GameStatus::Finished),
                result: Some(" ".to_string()),
                ..Default::default()
            },
            BotUpdate {
                status: Some(GameStatus::Finished),
                result: Some("x".repeat(MiniAppContent::MAX_RESULT_CHARS + 1)),
                ..Default::default()
            },
            BotUpdate {
                waiting_for: Some(vec![user(2)]),
                ..Default::default()
            },
            BotUpdate {
                waiting_for: Some(vec![user(1), user(1)]),
                ..Default::default()
            },
            // Removed and waited for at once
            BotUpdate {
                waiting_for: Some(vec![user(1)]),
                remove: vec![user(1)],
                ..Default::default()
            },
        ] {
            let mut update = update;
            update.state = Some(state(5));
            assert!(matches!(game.apply(update, 9), Err(UpdateError::Invalid(_))));
            assert_eq!(game, before);
        }
    }

    // States can arrive out of order, so an older one than the latest is dropped
    #[test]
    fn only_a_newer_state_replaces_the_latest() {
        let mut game = game(None);
        let with_state = |seq| BotUpdate {
            state: Some(state(seq)),
            ..Default::default()
        };
        assert!(game.apply(with_state(2), 1).unwrap().new_state);
        assert!(!game.apply(with_state(1), 2).unwrap().new_state);
        assert!(!game.apply(with_state(2), 3).unwrap().new_state);
        assert_eq!(game.state, Some(state(2)));
        assert_eq!(game.last_bot_update, 3);
    }

    // Before it started, with no one; after, with whoever it started with. A result the bot gave stays.
    #[test]
    fn an_abandoned_game_ends() {
        let mut game = game(None);
        game.add_player(user(1)).unwrap();
        game.abandon();
        assert_eq!(game.status, GameStatus::Finished);
        assert_eq!(
            catch_up(&mut game),
            vec![MiniAppStatusUpdate::Ended(MiniAppEnded { result: None })]
        );
        assert_eq!(game.card.players(), []);

        let mut game = self::game(None);
        game.add_player(user(1)).unwrap();
        game.apply(
            BotUpdate {
                status: Some(GameStatus::Finished),
                result: Some("Bob won".to_string()),
                ..Default::default()
            },
            1,
        )
        .unwrap();
        game.abandon();
        assert_eq!(game.result.as_deref(), Some("Bob won"));
    }
}
