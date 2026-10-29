// What the service does: the website's requests over its WebSocket, the bots' calls, and keeping the
// cards in the chats up to date
use crate::bots::{BotClient, JoinOutcome};
use crate::cards::{CardWriter, WriteError};
use crate::games::{BotUpdate, Game, UpdateError};
use crate::hub::{ConnectionId, Hub};
use crate::now_millis;
use crate::protocol::{ClientMessage, GameStatus, Refusal, RequestId, Role, ServerMessage, UpdateArgs};
use crate::store::Store;
use crate::tokens::Tokens;
use std::collections::HashSet;
use std::hash::{DefaultHasher, Hash, Hasher};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::{Mutex as AsyncMutex, MutexGuard};
use tracing::{error, info, warn};
use types::{Error, Milliseconds, MiniAppChatClaims, MiniAppGame, TimestampMillis, UserId};

// A game whose bot hasn't updated it for this long is ended
pub const ABANDONED_AFTER: Milliseconds = 24 * 60 * 60 * 1000;
// A card which can't be written for this long is given up on
const GIVE_UP_WRITING_AFTER: Milliseconds = 24 * 60 * 60 * 1000;
const LOCK_STRIPES: usize = 256;
const FIRST_RETRY_DELAY: Duration = Duration::from_secs(1);
const MAX_RETRY_DELAY: Duration = Duration::from_secs(60);

pub struct App {
    pub tokens: Arc<Tokens>,
    pub hub: Arc<Hub>,
    store: Arc<dyn Store>,
    bots: Arc<dyn BotClient>,
    cards: Arc<dyn CardWriter>,
    // Changes to a game happen one at a time: joins, leaves, its bot's updates and its card's writes.
    // None is held while a bot's called.
    locks: Vec<AsyncMutex<()>>,
    card_writes: Mutex<CardWrites>,
}

#[derive(Default)]
struct CardWrites {
    in_flight: HashSet<MiniAppGame>,
    // Games which changed while their card was being written, so are written again after
    again: HashSet<MiniAppGame>,
}

// A bot's call refused, as an HTTP status and a reason
#[derive(Debug, PartialEq, Eq)]
pub struct ApiError {
    pub status: u16,
    pub message: String,
}

impl ApiError {
    fn new(status: u16, message: &str) -> ApiError {
        ApiError {
            status,
            message: message.to_string(),
        }
    }
}

impl App {
    pub fn new(tokens: Arc<Tokens>, store: Arc<dyn Store>, bots: Arc<dyn BotClient>, cards: Arc<dyn CardWriter>) -> App {
        App {
            tokens,
            hub: Arc::new(Hub::default()),
            store,
            bots,
            cards,
            locks: (0..LOCK_STRIPES).map(|_| AsyncMutex::new(())).collect(),
            card_writes: Mutex::default(),
        }
    }

    pub async fn handle(self: &Arc<Self>, id: ConnectionId, user_id: UserId, message: ClientMessage) {
        match message {
            ClientMessage::Connect { .. } => {}
            ClientMessage::Follow {
                id: request,
                chat_token,
                games,
            } => self.follow(id, user_id, request, &chat_token, games).await,
            ClientMessage::Unfollow { games } => self.hub.unfollow(id, &games),
            ClientMessage::Join {
                id: request,
                chat_token,
                game,
            } => {
                let reply = self.join(user_id, request, &chat_token, game).await;
                self.hub.send(id, reply);
            }
            ClientMessage::Open {
                id: request,
                chat_token,
                game,
            } => self.open(id, user_id, request, &chat_token, game).await,
            ClientMessage::Close { game } => {
                if self.hub.close(id, &game) {
                    self.push_card(&game).await;
                }
            }
            ClientMessage::PlayerToken { id: request, game } => {
                let reply = self.player_token(user_id, request, game).await;
                self.hub.send(id, reply);
            }
            ClientMessage::Leave { id: request, game } => {
                let reply = self.leave(user_id, request, game).await;
                self.hub.send(id, reply);
            }
        }
    }

    async fn follow(&self, id: ConnectionId, user_id: UserId, request: RequestId, chat_token: &str, games: Vec<MiniAppGame>) {
        if let Err(reason) = self.chat_claims(chat_token, user_id, &games) {
            return self.hub.send(id, refused(request, reason));
        }
        self.hub.follow(id, &games);
        self.hub.send(id, ServerMessage::Ok { id: request });
        for game in games {
            if let Ok(Some(found)) = self.store.get(&game).await {
                self.hub.send(id, ServerMessage::Card(found.card(self.hub.watching(&game))));
            }
        }
    }

    // The bot's asked without holding the game's lock, as it may update the game before it answers.
    // Whatever changed meanwhile is checked again after.
    async fn join(&self, user_id: UserId, request: RequestId, chat_token: &str, game: MiniAppGame) -> ServerMessage {
        let claims = match self.chat_claims(chat_token, user_id, &[game]) {
            Ok(claims) => claims,
            Err(reason) => return refused(request, reason),
        };
        if !claims.member {
            return refused(request, Refusal::NotMember);
        }

        let found = match self.store.get(&game).await {
            Ok(Some(found)) => found,
            Ok(None) => return refused(request, Refusal::UnknownGame),
            Err(error) => return unavailable(request, error),
        };
        if found.is_player(user_id) {
            return self.joined(request, &found, user_id);
        }
        if let Err(reason) = found.can_join() {
            return refused(request, reason);
        }
        match self.bots.join(&found, user_id).await {
            JoinOutcome::Accepted => {}
            JoinOutcome::Refused(message) => {
                return ServerMessage::Refused {
                    id: request,
                    reason: Refusal::RefusedByBot,
                    message,
                };
            }
            // It may have accepted after the service gave up on it, so it's told the user isn't playing
            JoinOutcome::Unavailable => {
                self.tell_bot_left(found, user_id);
                return refused(request, Refusal::BotUnavailable);
            }
        }

        let _guard = self.lock(&game).await;
        let mut latest = match self.store.get(&game).await {
            Ok(Some(latest)) => latest,
            Ok(None) => {
                self.tell_bot_left(found, user_id);
                return refused(request, Refusal::UnknownGame);
            }
            Err(error) => {
                self.tell_bot_left(found, user_id);
                return unavailable(request, error);
            }
        };
        if let Err(reason) = latest.add_player(user_id) {
            self.tell_bot_left(latest, user_id);
            return refused(request, reason);
        }
        if let Err(error) = self.store.put(&latest).await {
            self.tell_bot_left(latest, user_id);
            return unavailable(request, error);
        }
        self.role_changed(&latest, user_id, true);
        self.hub.push_card(latest.card(self.hub.watching(&game)));
        self.joined(request, &latest, user_id)
    }

    fn joined(&self, request: RequestId, found: &Game, user_id: UserId) -> ServerMessage {
        ServerMessage::Joined {
            id: request,
            player_token: self.tokens.player(found.bot, found.game, user_id, now_millis()),
        }
    }

    async fn open(&self, id: ConnectionId, user_id: UserId, request: RequestId, chat_token: &str, game: MiniAppGame) {
        if let Err(reason) = self.chat_claims(chat_token, user_id, &[game]) {
            return self.hub.send(id, refused(request, reason));
        }
        let found = match self.store.get(&game).await {
            Ok(Some(found)) => found,
            Ok(None) => return self.hub.send(id, refused(request, Refusal::UnknownGame)),
            Err(error) => return self.hub.send(id, unavailable(request, error)),
        };
        let role = if found.is_player(user_id) {
            Role::Player
        } else if found.spectators {
            Role::Spectator
        } else {
            return self.hub.send(id, refused(request, Refusal::NoSpectators));
        };

        let watching_changed = self.hub.open(id, game, role);
        self.hub.send(
            id,
            ServerMessage::Opened {
                id: request,
                role,
                player_token: (role == Role::Player).then(|| self.tokens.player(found.bot, game, user_id, now_millis())),
            },
        );
        // Read again, so a state pushed before the connection was open isn't missed. The website drops
        // a state no newer than one it has.
        if let Ok(Some(latest)) = self.store.get(&game).await
            && let Some(state) = &latest.state
        {
            self.hub.send_latest_state(&[id], game, state, role);
        }
        if watching_changed {
            self.push_card(&game).await;
        }
    }

    async fn player_token(&self, user_id: UserId, request: RequestId, game: MiniAppGame) -> ServerMessage {
        match self.store.get(&game).await {
            Ok(Some(found)) if found.is_player(user_id) => ServerMessage::PlayerToken {
                id: request,
                token: self.tokens.player(found.bot, game, user_id, now_millis()),
            },
            Ok(Some(_)) => refused(request, Refusal::NotAPlayer),
            Ok(None) => refused(request, Refusal::UnknownGame),
            Err(error) => unavailable(request, error),
        }
    }

    // The bot's told before the reply, so the user rejoining after it can't overtake it
    async fn leave(&self, user_id: UserId, request: RequestId, game: MiniAppGame) -> ServerMessage {
        let left = {
            let _guard = self.lock(&game).await;
            let mut found = match self.store.get(&game).await {
                Ok(Some(found)) => found,
                Ok(None) => return refused(request, Refusal::UnknownGame),
                Err(error) => return unavailable(request, error),
            };
            match found.leave(user_id) {
                Ok(true) => {}
                Ok(false) => return ServerMessage::Ok { id: request },
                Err(reason) => return refused(request, reason),
            }
            if let Err(error) = self.store.put(&found).await {
                return unavailable(request, error);
            }
            self.role_changed(&found, user_id, false);
            self.hub.push_card(found.card(self.hub.watching(&game)));
            found
        };
        if let Err(error) = self.bots.leave(&left, user_id).await {
            warn!(bot = %left.bot, %error, "Failed to tell a bot a player left");
        }
        ServerMessage::Ok { id: request }
    }

    // A bot registering a game it posted, with the token posting it gave it. A game which has ended
    // stays ended.
    pub async fn register(&self, bot: UserId, registration: &str) -> Result<(), ApiError> {
        let now = now_millis();
        let Some(claims) = self.tokens.registration(registration, now) else {
            return Err(ApiError::new(400, "Invalid registration"));
        };
        if claims.bot != bot {
            return Err(ApiError::new(403, "Another bot's game"));
        }
        let _guard = self.lock(&claims.game).await;
        if self.store.has_ended(&claims.game).await.map_err(store_error)? {
            return Ok(());
        }
        match self.store.get(&claims.game).await {
            Ok(Some(_)) => Ok(()),
            Ok(None) => {
                info!(%bot, game = ?claims.game, "Game registered");
                self.store.put(&Game::register(claims, now)).await.map_err(store_error)
            }
            Err(error) => Err(store_error(error)),
        }
    }

    // A bot's update to one of its games
    pub async fn update(self: &Arc<Self>, bot: UserId, args: UpdateArgs) -> Result<(), ApiError> {
        let game = args.game;
        let _guard = self.lock(&game).await;
        let mut found = match self.store.get(&game).await {
            Ok(Some(found)) => found,
            Ok(None) => return Err(ApiError::new(404, "Unknown game")),
            Err(error) => return Err(store_error(error)),
        };
        if found.bot != bot {
            return Err(ApiError::new(403, "Another bot's game"));
        }
        let removed = args.remove.clone();
        let update = BotUpdate {
            status: args.status,
            waiting_for: args.waiting_for,
            result: args.result,
            remove: args.remove,
            state: args.state,
        };
        let applied = match found.apply(update, now_millis()) {
            Ok(applied) => applied,
            Err(UpdateError::Finished) => return Err(ApiError::new(409, "The game has finished")),
            Err(UpdateError::Invalid(message)) => return Err(ApiError::new(400, &message)),
        };
        self.store.put(&found).await.map_err(store_error)?;

        for user_id in removed {
            self.role_changed(&found, user_id, false);
        }
        if applied.new_state
            && let Some(state) = &found.state
        {
            self.hub.push_state(game, state);
        }
        if applied.card_changed {
            self.hub.push_card(found.card(self.hub.watching(&game)));
        }
        if applied.write_card {
            self.write_card(game);
        }
        Ok(())
    }

    // Run on starting and then every few minutes: ends the games whose bots haven't updated them for a
    // day, and writes any card which hasn't caught up with its game, eg. as the service restarted
    // before writing it
    pub async fn maintain(self: &Arc<Self>) {
        let now = now_millis();
        let games = match self.store.all().await {
            Ok(games) => games,
            Err(error) => return error!(%error, "Failed to list the games"),
        };
        for game in games {
            let write = {
                let _guard = self.lock(&game).await;
                let Ok(Some(mut found)) = self.store.get(&game).await else {
                    continue;
                };
                if found.status != GameStatus::Finished && found.last_bot_update < now.saturating_sub(ABANDONED_AFTER) {
                    info!(game = ?game, "Ending an abandoned game");
                    found.abandon();
                    if let Err(error) = self.store.put(&found).await {
                        error!(%error, "Failed to end an abandoned game");
                        continue;
                    }
                    self.hub.push_card(found.card(self.hub.watching(&game)));
                }
                found.next_card_update().is_some() || found.is_done()
            };
            if write {
                self.write_card(game);
            }
        }
    }

    // Brings the game's card up to date, now, or once the write in flight is done
    fn write_card(self: &Arc<Self>, game: MiniAppGame) {
        let mut writes = self.card_writes.lock().unwrap();
        if !writes.in_flight.insert(game) {
            writes.again.insert(game);
            return;
        }
        let app = self.clone();
        tokio::spawn(async move {
            loop {
                app.write_card_until_done(game).await;
                let mut writes = app.card_writes.lock().unwrap();
                if !writes.again.remove(&game) {
                    writes.in_flight.remove(&game);
                    break;
                }
            }
        });
    }

    // Writes whatever the card needs next until it's caught up with the game. Each update is one the
    // card, as the service last wrote it, can take.
    async fn write_card_until_done(&self, game: MiniAppGame) {
        let mut retry = Retry::new();
        loop {
            let found = match self.store.get(&game).await {
                Ok(Some(found)) => found,
                Ok(None) => return,
                Err(error) => {
                    warn!(%error, "Failed to read a game to write its card");
                    if retry.wait().await {
                        continue;
                    }
                    return;
                }
            };
            let Some(update) = found.next_card_update() else {
                if found.is_done() {
                    self.end(&game).await;
                }
                return;
            };
            let result = match self.cards.write(found.bot_api_gateway, &game, update.clone()).await {
                Ok(()) => self.change(&game, |found| found.card_updated(&update)).await,
                // Only ending the game goes through now
                Err(WriteError::BotUninstalled) => {
                    info!(game = ?game, "Ending a game whose bot was uninstalled");
                    let result = self
                        .change(&game, |found| {
                            found.bot_uninstalled = true;
                            found.abandon();
                        })
                        .await;
                    self.push_card(&game).await;
                    result
                }
                Err(WriteError::CardDeleted) => {
                    info!(game = ?game, "Ending a game whose card was deleted");
                    return self.end(&game).await;
                }
                // The service's idea of the card is wrong, which retrying won't put right
                Err(WriteError::Refused(error)) => {
                    error!(game = ?game, error, "OpenChat refused a card update, so ending the game");
                    let _ = self.change(&game, Game::abandon).await;
                    self.push_card(&game).await;
                    return self.end(&game).await;
                }
                Err(WriteError::Failed(error)) => Err(error.into()),
            };
            match result {
                Ok(()) => retry.reset(),
                Err(error) => {
                    warn!(game = ?game, %error, "Failed to update a card, retrying");
                    if !retry.wait().await {
                        error!(game = ?game, "Giving up on updating a card, so ending the game");
                        return self.end(&game).await;
                    }
                }
            }
        }
    }

    // Changes the game as it's stored, under its lock
    async fn change(&self, game: &MiniAppGame, f: impl FnOnce(&mut Game)) -> Result<(), Error> {
        let _guard = self.lock(game).await;
        if let Some(mut found) = self.store.get(game).await? {
            f(&mut found);
            self.store.put(&found).await?;
        }
        Ok(())
    }

    // A game is forgotten once it's over and its card says so, or the card's gone
    async fn end(&self, game: &MiniAppGame) {
        let _guard = self.lock(game).await;
        if let Err(error) = self.store.end(game).await {
            error!(%error, "Failed to forget an ended game");
        }
        self.hub.end(game);
    }

    pub async fn push_card(&self, game: &MiniAppGame) {
        let _guard = self.lock(game).await;
        if let Ok(Some(found)) = self.store.get(game).await {
            self.hub.push_card(found.card(self.hub.watching(game)));
        }
    }

    // A user started or stopped playing: their connections with the game open are told their new role,
    // then get the latest state, with their own part if they're now a player, or have the game closed if
    // they can no longer watch. The website tells the app its new role before the state, which has the
    // same seq as the one the app has.
    fn role_changed(&self, found: &Game, user_id: UserId, playing: bool) {
        let role = if playing {
            Some(Role::Player)
        } else if found.spectators {
            Some(Role::Spectator)
        } else {
            None
        };
        let (ids, _) = self.hub.set_role(found.game, user_id, role);
        let message = match role {
            Some(role) => ServerMessage::Role {
                game: found.game,
                role,
                player_token: (role == Role::Player).then(|| self.tokens.player(found.bot, found.game, user_id, now_millis())),
            },
            None => ServerMessage::Closed { game: found.game },
        };
        for id in &ids {
            self.hub.send(*id, message.clone());
        }
        if let (Some(role), Some(state)) = (role, &found.state) {
            self.hub.send_latest_state(&ids, found.game, state, role);
        }
    }

    // Tells the bot a user isn't playing after all, eg. it accepted them too late
    fn tell_bot_left(&self, found: Game, user_id: UserId) {
        let bots = self.bots.clone();
        tokio::spawn(async move {
            if let Err(error) = bots.leave(&found, user_id).await {
                warn!(bot = %found.bot, %error, "Failed to tell a bot a player isn't playing");
            }
        });
    }

    // The chat token's claims, if it's the user's, and is for the games' chat
    fn chat_claims(&self, chat_token: &str, user_id: UserId, games: &[MiniAppGame]) -> Result<MiniAppChatClaims, Refusal> {
        let claims = self
            .tokens
            .chat(chat_token, user_id, now_millis())
            .ok_or(Refusal::InvalidToken)?;
        if games.iter().any(|game| game.chat != claims.chat) {
            return Err(Refusal::WrongChat);
        }
        Ok(claims)
    }

    async fn lock(&self, game: &MiniAppGame) -> MutexGuard<'_, ()> {
        let mut hasher = DefaultHasher::new();
        game.hash(&mut hasher);
        self.locks[hasher.finish() as usize % LOCK_STRIPES].lock().await
    }
}

// Backs off from a failure, doubling the delay each time, until it gives up
struct Retry {
    delay: Duration,
    give_up_at: TimestampMillis,
}

impl Retry {
    fn new() -> Retry {
        Retry {
            delay: FIRST_RETRY_DELAY,
            give_up_at: now_millis() + GIVE_UP_WRITING_AFTER,
        }
    }

    fn reset(&mut self) {
        self.delay = FIRST_RETRY_DELAY;
    }

    // Whether to try again, having waited
    async fn wait(&mut self) -> bool {
        if now_millis() > self.give_up_at {
            return false;
        }
        tokio::time::sleep(self.delay).await;
        self.delay = (self.delay * 2).min(MAX_RETRY_DELAY);
        true
    }
}

fn refused(id: RequestId, reason: Refusal) -> ServerMessage {
    ServerMessage::Refused {
        id,
        reason,
        message: None,
    }
}

fn unavailable(id: RequestId, error: Error) -> ServerMessage {
    error!(%error, "Failed to read or save a game");
    refused(id, Refusal::Unavailable)
}

fn store_error(error: Error) -> ApiError {
    error!(%error, "Failed to read or save a game");
    ApiError::new(503, "Unavailable")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::{Card, GameState};
    use crate::store::MemoryStore;
    use crate::tokens::tests::{oc_token, tokens};
    use async_trait::async_trait;
    use candid::Principal;
    use p256_key_pair::P256KeyPair;
    use serde_json::json;
    use std::collections::HashMap;
    use tokio::sync::Notify;
    use tokio::sync::mpsc::{Receiver, channel};
    use types::{
        CLAIM_TYPE_MINI_APP_CHAT, CLAIM_TYPE_MINI_APP_REGISTRATION, CanisterId, Chat, MiniAppActive, MiniAppContent,
        MiniAppFinished, MiniAppRegistrationClaims, MiniAppStatus, MiniAppStatusUpdate,
    };

    const HOUR: Milliseconds = 60 * 60 * 1000;
    const BOT: u8 = 100;

    struct FakeBot {
        // How the bot answers each join request
        answer: Mutex<JoinOutcome>,
        // If set, the bot answers once it's notified
        gate: Mutex<Option<Arc<Notify>>>,
        joined: Mutex<Vec<UserId>>,
        left: Mutex<Vec<UserId>>,
    }

    #[async_trait]
    impl BotClient for FakeBot {
        async fn join(&self, _game: &Game, user_id: UserId) -> JoinOutcome {
            self.joined.lock().unwrap().push(user_id);
            let gate = self.gate.lock().unwrap().clone();
            if let Some(gate) = gate {
                gate.notified().await;
            }
            match &*self.answer.lock().unwrap() {
                JoinOutcome::Accepted => JoinOutcome::Accepted,
                JoinOutcome::Refused(message) => JoinOutcome::Refused(message.clone()),
                JoinOutcome::Unavailable => JoinOutcome::Unavailable,
            }
        }

        async fn leave(&self, _game: &Game, user_id: UserId) -> Result<(), Error> {
            self.left.lock().unwrap().push(user_id);
            Ok(())
        }
    }

    // The card in the chat, which takes or refuses an update as the canister does
    struct FakeCards {
        card: Mutex<MiniAppContent>,
        written: Mutex<Vec<MiniAppStatusUpdate>>,
        bot_uninstalled: Mutex<bool>,
        // How many writes fail before they go through
        failures: Mutex<u32>,
    }

    impl Default for FakeCards {
        fn default() -> FakeCards {
            FakeCards {
                card: Mutex::new(MiniAppContent {
                    text: "Uno".to_string(),
                    image: None,
                    max_players: None,
                    spectators: true,
                    status: MiniAppStatus::Open,
                }),
                written: Mutex::default(),
                bot_uninstalled: Mutex::default(),
                failures: Mutex::default(),
            }
        }
    }

    #[async_trait]
    impl CardWriter for FakeCards {
        async fn write(
            &self,
            _gateway: CanisterId,
            _game: &MiniAppGame,
            update: MiniAppStatusUpdate,
        ) -> Result<(), WriteError> {
            {
                let mut failures = self.failures.lock().unwrap();
                if *failures > 0 {
                    *failures -= 1;
                    return Err(WriteError::Failed("Stopped for an upgrade".to_string()));
                }
            }
            if *self.bot_uninstalled.lock().unwrap() && !matches!(update, MiniAppStatusUpdate::Ended(_)) {
                return Err(WriteError::BotUninstalled);
            }
            let mut card = self.card.lock().unwrap();
            let mut updated = card.clone();
            updated.status = updated.next_status(update.clone()).map_err(WriteError::Refused)?;
            updated.validate().map_err(WriteError::Refused)?;
            *card = updated;
            self.written.lock().unwrap().push(update);
            Ok(())
        }
    }

    struct Test {
        app: Arc<App>,
        oc: P256KeyPair,
        bot: Arc<FakeBot>,
        cards: Arc<FakeCards>,
        store: Arc<MemoryStore>,
    }

    fn user(n: u8) -> UserId {
        Principal::from_slice(&[n]).into()
    }

    fn chat() -> Chat {
        Chat::Group(Principal::from_slice(&[9]).into())
    }

    fn game() -> MiniAppGame {
        MiniAppGame {
            chat: chat(),
            thread: None,
            message_id: 7u64.into(),
        }
    }

    fn update(status: Option<GameStatus>) -> UpdateArgs {
        UpdateArgs {
            game: game(),
            status,
            waiting_for: None,
            result: None,
            remove: Vec::new(),
            state: None,
        }
    }

    impl Test {
        fn new() -> Test {
            let oc = P256KeyPair::new(&mut rand::rng());
            let bot = Arc::new(FakeBot {
                answer: Mutex::new(JoinOutcome::Accepted),
                gate: Mutex::default(),
                joined: Mutex::default(),
                left: Mutex::default(),
            });
            let cards = Arc::new(FakeCards::default());
            let store = Arc::new(MemoryStore::default());
            let app = Arc::new(App::new(Arc::new(tokens(&oc)), store.clone(), bot.clone(), cards.clone()));
            Test {
                app,
                oc,
                bot,
                cards,
                store,
            }
        }

        fn registration(&self, max_players: Option<u32>, spectators: bool) -> String {
            oc_token(
                &self.oc,
                CLAIM_TYPE_MINI_APP_REGISTRATION,
                MiniAppRegistrationClaims {
                    bot: user(BOT),
                    bot_endpoint: "https://uno.example.com".to_string(),
                    bot_api_gateway: Principal::from_slice(&[200]),
                    game: game(),
                    max_players,
                    spectators,
                },
                now_millis() + HOUR,
            )
        }

        async fn register(&self, max_players: Option<u32>, spectators: bool) {
            self.app
                .register(user(BOT), &self.registration(max_players, spectators))
                .await
                .unwrap();
        }

        fn chat_token(&self, user_id: UserId, member: bool) -> String {
            oc_token(
                &self.oc,
                CLAIM_TYPE_MINI_APP_CHAT,
                MiniAppChatClaims {
                    user_id,
                    chat: chat(),
                    member,
                },
                now_millis() + HOUR,
            )
        }

        fn connect(&self, user_id: UserId) -> (ConnectionId, Receiver<Arc<ServerMessage>>) {
            let (sender, receiver) = channel(64);
            (self.app.hub.connect(user_id, sender), receiver)
        }

        async fn join(&self, user_id: UserId) -> ServerMessage {
            self.app.join(user_id, 1, &self.chat_token(user_id, true), game()).await
        }

        async fn update(&self, args: UpdateArgs) -> Result<(), ApiError> {
            self.app.update(user(BOT), args).await
        }

        async fn stored(&self) -> Option<Game> {
            self.store.get(&game()).await.unwrap()
        }

        fn card(&self) -> MiniAppStatus {
            self.cards.card.lock().unwrap().status.clone()
        }

        // Lets the spawned card writes run
        async fn settle(&self) {
            for _ in 0..20 {
                tokio::task::yield_now().await;
            }
        }
    }

    fn cards(receiver: &mut Receiver<Arc<ServerMessage>>) -> Vec<Card> {
        let mut cards = Vec::new();
        while let Ok(message) = receiver.try_recv() {
            if let ServerMessage::Card(card) = &*message {
                cards.push(card.clone());
            }
        }
        cards
    }

    fn messages(receiver: &mut Receiver<Arc<ServerMessage>>) -> Vec<ServerMessage> {
        let mut messages = Vec::new();
        while let Ok(message) = receiver.try_recv() {
            messages.push((*message).clone());
        }
        messages
    }

    #[tokio::test]
    async fn a_member_joins_once_the_bot_accepts_and_followers_see_it() {
        let test = Test::new();
        test.register(Some(4), true).await;
        let (follower, mut follower_messages) = test.connect(user(3));
        test.app
            .follow(follower, user(3), 1, &test.chat_token(user(3), false), vec![game()])
            .await;
        assert_eq!(cards(&mut follower_messages).len(), 1);

        let reply = test.join(user(1)).await;
        assert!(matches!(reply, ServerMessage::Joined { id: 1, .. }), "{reply:?}");
        assert_eq!(test.stored().await.unwrap().players, vec![user(1)]);
        assert_eq!(cards(&mut follower_messages)[0].players, vec![user(1)]);

        // Asking again just gets their token, without asking the bot
        assert!(matches!(test.join(user(1)).await, ServerMessage::Joined { .. }));
        assert_eq!(*test.bot.joined.lock().unwrap(), vec![user(1)]);
        // Nothing's written to the card in the chat while the game's taking players
        test.settle().await;
        assert!(test.cards.written.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn a_join_is_refused_by_the_bot_or_the_service() {
        let test = Test::new();
        test.register(Some(1), true).await;

        *test.bot.answer.lock().unwrap() = JoinOutcome::Refused(Some("Seats are taken".to_string()));
        assert_eq!(
            test.join(user(1)).await,
            ServerMessage::Refused {
                id: 1,
                reason: Refusal::RefusedByBot,
                message: Some("Seats are taken".to_string()),
            }
        );
        // It may have accepted after the service gave up, so it's told the user isn't playing
        *test.bot.answer.lock().unwrap() = JoinOutcome::Unavailable;
        assert!(matches!(
            test.join(user(1)).await,
            ServerMessage::Refused {
                reason: Refusal::BotUnavailable,
                ..
            }
        ));
        test.settle().await;
        assert_eq!(*test.bot.left.lock().unwrap(), vec![user(1)]);
        assert!(test.stored().await.unwrap().players.is_empty());

        *test.bot.answer.lock().unwrap() = JoinOutcome::Accepted;
        test.join(user(1)).await;
        assert!(matches!(
            test.join(user(2)).await,
            ServerMessage::Refused {
                reason: Refusal::Full,
                ..
            }
        ));

        // Someone who can only see the chat watches, and nobody joins with another's token
        let reply = test.app.join(user(3), 1, &test.chat_token(user(3), false), game()).await;
        assert!(matches!(
            reply,
            ServerMessage::Refused {
                reason: Refusal::NotMember,
                ..
            }
        ));
        let reply = test.app.join(user(3), 1, &test.chat_token(user(4), true), game()).await;
        assert!(matches!(
            reply,
            ServerMessage::Refused {
                reason: Refusal::InvalidToken,
                ..
            }
        ));
        assert_eq!(test.stored().await.unwrap().players, vec![user(1)]);
    }

    // So a bot can update its game before it answers. If the game's changed meanwhile, eg. it started,
    // the join's refused, and the bot's told the user isn't playing.
    #[tokio::test]
    async fn a_join_doesnt_hold_up_the_game_while_the_bot_answers() {
        let test = Test::new();
        test.register(None, true).await;
        let gate = Arc::new(Notify::new());
        *test.bot.gate.lock().unwrap() = Some(gate.clone());

        let app = test.app.clone();
        let chat_token = test.chat_token(user(1), true);
        let join = tokio::spawn(async move { app.join(user(1), 1, &chat_token, game()).await });
        test.settle().await;

        test.update(update(Some(GameStatus::Active))).await.unwrap();
        gate.notify_one();
        assert!(matches!(
            join.await.unwrap(),
            ServerMessage::Refused {
                reason: Refusal::NotOpen,
                ..
            }
        ));
        test.settle().await;
        assert_eq!(*test.bot.left.lock().unwrap(), vec![user(1)]);
    }

    // The card in the chat records the players the game started with, whose turn it is, then its
    // result, after which the service forgets the game, and doesn't let its bot register it again
    #[tokio::test]
    async fn the_card_follows_the_game_from_its_start_to_its_end() {
        let test = Test::new();
        test.register(None, true).await;
        test.join(user(1)).await;
        test.join(user(2)).await;

        test.update(UpdateArgs {
            waiting_for: Some(vec![user(1)]),
            ..update(Some(GameStatus::Active))
        })
        .await
        .unwrap();
        test.settle().await;
        assert_eq!(
            test.card(),
            MiniAppStatus::Active(MiniAppActive {
                players: vec![user(1), user(2)],
                waiting_for: vec![user(1)],
            })
        );
        assert!(matches!(
            test.join(user(3)).await,
            ServerMessage::Refused {
                reason: Refusal::NotOpen,
                ..
            }
        ));

        test.update(UpdateArgs {
            waiting_for: Some(vec![user(2)]),
            ..update(None)
        })
        .await
        .unwrap();
        test.settle().await;
        assert!(matches!(&test.card(), MiniAppStatus::Active(active) if active.waiting_for == vec![user(2)]));

        test.update(UpdateArgs {
            result: Some("Bob won".to_string()),
            ..update(Some(GameStatus::Finished))
        })
        .await
        .unwrap();
        test.settle().await;
        assert_eq!(
            test.card(),
            MiniAppStatus::Finished(MiniAppFinished {
                players: vec![user(1), user(2)],
                result: Some("Bob won".to_string()),
            })
        );
        assert!(test.stored().await.is_none());
        assert_eq!(test.update(update(None)).await.unwrap_err().status, 404);

        test.app.register(user(BOT), &test.registration(None, true)).await.unwrap();
        assert!(test.stored().await.is_none());
    }

    // The game finishing while its start is still being written: the card records who played, then the
    // result
    #[tokio::test(start_paused = true)]
    async fn the_card_catches_up_after_failed_writes() {
        let test = Test::new();
        test.register(None, true).await;
        test.join(user(1)).await;
        *test.cards.failures.lock().unwrap() = 2;

        test.update(update(Some(GameStatus::Active))).await.unwrap();
        test.settle().await;
        test.update(update(Some(GameStatus::Finished))).await.unwrap();
        tokio::time::sleep(Duration::from_secs(10)).await;
        test.settle().await;

        assert_eq!(
            test.card(),
            MiniAppStatus::Finished(MiniAppFinished {
                players: vec![user(1)],
                result: None,
            })
        );
        assert!(test.stored().await.is_none());
    }

    // Only ending the game goes through then
    #[tokio::test]
    async fn a_game_ends_when_its_bot_is_uninstalled() {
        let test = Test::new();
        test.register(None, true).await;
        test.join(user(1)).await;
        *test.cards.bot_uninstalled.lock().unwrap() = true;

        test.update(update(Some(GameStatus::Active))).await.unwrap();
        test.settle().await;
        assert_eq!(
            test.card(),
            MiniAppStatus::Finished(MiniAppFinished {
                players: Vec::new(),
                result: None,
            })
        );
        assert!(test.stored().await.is_none());
    }

    // As the service restarted before writing it
    #[tokio::test]
    async fn a_card_which_hasnt_caught_up_is_written_by_maintenance() {
        let test = Test::new();
        test.register(None, true).await;
        let mut stored = test.stored().await.unwrap();
        stored.players = vec![user(1)];
        stored.started_with = vec![user(1)];
        stored.status = GameStatus::Active;
        test.store.put(&stored).await.unwrap();

        test.app.maintain().await;
        test.settle().await;
        assert_eq!(test.card().players(), [user(1)]);
    }

    #[tokio::test]
    async fn an_abandoned_game_ends() {
        let test = Test::new();
        test.register(None, true).await;
        test.join(user(1)).await;
        let mut stored = test.stored().await.unwrap();
        stored.last_bot_update = now_millis() - ABANDONED_AFTER - 1;
        test.store.put(&stored).await.unwrap();

        test.app.maintain().await;
        test.settle().await;
        assert_eq!(
            test.card(),
            MiniAppStatus::Finished(MiniAppFinished {
                players: Vec::new(),
                result: None,
            })
        );
        assert!(test.stored().await.is_none());
    }

    #[tokio::test]
    async fn only_the_games_bot_updates_it_and_only_with_whats_valid() {
        let test = Test::new();
        test.register(None, true).await;
        test.join(user(1)).await;
        let error = test
            .app
            .update(user(101), update(Some(GameStatus::Active)))
            .await
            .unwrap_err();
        assert_eq!(error.status, 403);
        for args in [
            UpdateArgs {
                result: Some("x".to_string()),
                ..update(Some(GameStatus::Active))
            },
            UpdateArgs {
                waiting_for: Some(vec![user(2)]),
                ..update(None)
            },
        ] {
            assert_eq!(test.update(args).await.unwrap_err().status, 400);
        }
        assert_eq!(test.stored().await.unwrap().status, GameStatus::Open);
    }

    // A player gets their token and their own part of the state, a spectator the shared part, and is
    // counted on the card
    #[tokio::test]
    async fn players_and_spectators_open_the_game() {
        let test = Test::new();
        test.register(None, true).await;
        test.join(user(1)).await;
        test.update(UpdateArgs {
            state: Some(GameState {
                seq: 1,
                shared: json!({ "turn": 0 }),
                private: HashMap::from([(user(1), json!({ "hand": [1] }))]),
            }),
            ..update(None)
        })
        .await
        .unwrap();

        let (player, mut player_messages) = test.connect(user(1));
        test.app
            .open(player, user(1), 1, &test.chat_token(user(1), true), game())
            .await;
        let player_received = messages(&mut player_messages);
        assert!(matches!(
            player_received[0],
            ServerMessage::Opened {
                role: Role::Player,
                player_token: Some(_),
                ..
            }
        ));
        assert!(matches!(player_received[1], ServerMessage::State { private: Some(_), .. }));

        let (follower, mut follower_messages) = test.connect(user(3));
        test.app
            .follow(follower, user(3), 1, &test.chat_token(user(3), false), vec![game()])
            .await;
        cards(&mut follower_messages);
        let (spectator, mut spectator_messages) = test.connect(user(2));
        test.app
            .open(spectator, user(2), 1, &test.chat_token(user(2), false), game())
            .await;
        let spectator_received = messages(&mut spectator_messages);
        assert!(matches!(
            spectator_received[0],
            ServerMessage::Opened {
                role: Role::Spectator,
                player_token: None,
                ..
            }
        ));
        assert!(matches!(spectator_received[1], ServerMessage::State { private: None, .. }));
        assert_eq!(cards(&mut follower_messages)[0].watching, 1);

        let reply = test.app.player_token(user(2), 1, game()).await;
        assert!(matches!(
            reply,
            ServerMessage::Refused {
                reason: Refusal::NotAPlayer,
                ..
            }
        ));
    }

    // Their open app is told they're a player, then gets their own part of the state, and they're no
    // longer counted watching
    #[tokio::test]
    async fn a_spectator_who_joins_plays_from_the_app_they_have_open() {
        let test = Test::new();
        test.register(None, true).await;
        test.update(UpdateArgs {
            state: Some(GameState {
                seq: 1,
                shared: json!({}),
                private: HashMap::from([(user(1), json!({ "seat": 0 }))]),
            }),
            ..update(None)
        })
        .await
        .unwrap();
        let (tab, mut tab_messages) = test.connect(user(1));
        test.app.open(tab, user(1), 1, &test.chat_token(user(1), true), game()).await;
        assert_eq!(test.app.hub.watching(&game()), 1);
        messages(&mut tab_messages);

        test.join(user(1)).await;
        let received = messages(&mut tab_messages);
        let role = received.iter().position(|message| {
            matches!(
                message,
                ServerMessage::Role {
                    role: Role::Player,
                    player_token: Some(_),
                    ..
                }
            )
        });
        let state = received.iter().position(|message| {
            matches!(
                message,
                ServerMessage::State {
                    seq: 1,
                    private: Some(_),
                    ..
                }
            )
        });
        assert!(role.is_some() && role < state, "{received:?}");
        assert_eq!(test.app.hub.watching(&game()), 0);
    }

    // They watch from the app they have open, or it's closed if the game doesn't allow spectators
    #[tokio::test]
    async fn a_player_who_leaves_watches_or_has_the_game_closed() {
        for spectators in [true, false] {
            let test = Test::new();
            test.register(None, spectators).await;
            test.join(user(1)).await;
            let (tab, mut tab_messages) = test.connect(user(1));
            test.app.open(tab, user(1), 1, &test.chat_token(user(1), true), game()).await;
            messages(&mut tab_messages);

            test.app.leave(user(1), 2, game()).await;
            let expected = if spectators {
                ServerMessage::Role {
                    game: game(),
                    role: Role::Spectator,
                    player_token: None,
                }
            } else {
                ServerMessage::Closed { game: game() }
            };
            assert_eq!(messages(&mut tab_messages), vec![expected]);
        }
    }

    #[tokio::test]
    async fn a_game_closed_to_spectators_opens_only_for_its_players() {
        let test = Test::new();
        test.register(None, false).await;
        let (spectator, mut spectator_messages) = test.connect(user(2));
        test.app
            .open(spectator, user(2), 1, &test.chat_token(user(2), true), game())
            .await;
        assert!(matches!(
            messages(&mut spectator_messages)[0],
            ServerMessage::Refused {
                reason: Refusal::NoSpectators,
                ..
            }
        ));
    }

    #[tokio::test]
    async fn a_player_leaves_and_the_bot_is_told() {
        let test = Test::new();
        test.register(None, true).await;
        test.join(user(1)).await;

        assert_eq!(test.app.leave(user(1), 1, game()).await, ServerMessage::Ok { id: 1 });
        assert!(test.stored().await.unwrap().players.is_empty());
        assert_eq!(*test.bot.left.lock().unwrap(), vec![user(1)]);
    }

    #[tokio::test]
    async fn a_bot_registers_only_its_own_games() {
        let test = Test::new();
        let registration = test.registration(None, true);
        assert_eq!(test.app.register(user(101), &registration).await.unwrap_err().status, 403);
        assert_eq!(test.app.register(user(BOT), "nonsense").await.unwrap_err().status, 400);
        test.app.register(user(BOT), &registration).await.unwrap();
        test.app.register(user(BOT), &registration).await.unwrap();
        assert!(test.stored().await.is_some());
    }
}
