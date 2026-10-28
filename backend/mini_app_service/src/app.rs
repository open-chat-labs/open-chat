// What the service does: the website's requests over its WebSocket, the bots' calls, and keeping the
// cards in the chats up to date
use crate::bots::{BotClient, JoinOutcome};
use crate::cards::{CardWriter, WriteError};
use crate::games::{Game, UpdateError};
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
use types::{Milliseconds, MiniAppChatClaims, MiniAppGame, UserId};

// A game whose bot hasn't updated it for this long is ended
pub const ABANDONED_AFTER: Milliseconds = 24 * 60 * 60 * 1000;
const LOCK_STRIPES: usize = 256;
const MAX_WRITE_DELAY: Duration = Duration::from_secs(60);

pub struct App {
    pub tokens: Arc<Tokens>,
    pub hub: Arc<Hub>,
    store: Arc<dyn Store>,
    bots: Arc<dyn BotClient>,
    cards: Arc<dyn CardWriter>,
    // Changes to a game happen one at a time: joins, leaves and its bot's updates
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
        let claims = match self.chat_claims(chat_token, user_id, &games) {
            Ok(claims) => claims,
            Err(reason) => return self.hub.send(id, refused(request, reason)),
        };
        if games.iter().any(|game| game.chat != claims.chat) {
            return self.hub.send(id, refused(request, Refusal::WrongChat));
        }
        self.hub.follow(id, &games);
        self.hub.send(id, ServerMessage::Ok { id: request });
        for game in games {
            if let Ok(Some(found)) = self.store.get(&game).await {
                self.hub.send(id, ServerMessage::Card(found.card(self.hub.watching(&game))));
            }
        }
    }

    async fn join(&self, user_id: UserId, request: RequestId, chat_token: &str, game: MiniAppGame) -> ServerMessage {
        let claims = match self.chat_claims(chat_token, user_id, &[game]) {
            Ok(claims) => claims,
            Err(reason) => return refused(request, reason),
        };
        if !claims.member {
            return refused(request, Refusal::NotMember);
        }

        let _guard = self.lock(&game).await;
        let mut found = match self.store.get(&game).await {
            Ok(Some(found)) => found,
            Ok(None) => return refused(request, Refusal::UnknownGame),
            Err(error) => return unavailable(request, error),
        };
        if !found.is_player(user_id) {
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
                JoinOutcome::Unavailable => return refused(request, Refusal::BotUnavailable),
            }
            if let Err(reason) = found.add_player(user_id) {
                return refused(request, reason);
            }
            if let Err(error) = self.store.put(&found).await {
                return unavailable(request, error);
            }
            self.hub.push_card(found.card(self.hub.watching(&game)));
        }

        ServerMessage::Joined {
            id: request,
            player_token: self.tokens.player(found.bot, game, user_id, now_millis()),
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
        if let Some(state) = &found.state {
            self.hub.send_latest_state(id, game, state, role);
        }
        if watching_changed {
            self.hub.push_card(found.card(self.hub.watching(&game)));
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

    async fn leave(&self, user_id: UserId, request: RequestId, game: MiniAppGame) -> ServerMessage {
        let _guard = self.lock(&game).await;
        let mut found = match self.store.get(&game).await {
            Ok(Some(found)) => found,
            Ok(None) => return refused(request, Refusal::UnknownGame),
            Err(error) => return unavailable(request, error),
        };
        match found.leave(user_id) {
            Ok(true) => {
                if let Err(error) = self.store.put(&found).await {
                    return unavailable(request, error);
                }
                self.hub.push_card(found.card(self.hub.watching(&game)));
                let bots = self.bots.clone();
                tokio::spawn(async move {
                    if let Err(error) = bots.leave(&found, user_id).await {
                        warn!(bot = %found.bot, %error, "Failed to tell a bot a player left");
                    }
                });
                ServerMessage::Ok { id: request }
            }
            Ok(false) => ServerMessage::Ok { id: request },
            Err(reason) => refused(request, reason),
        }
    }

    // A bot registering a game it posted, with the token posting it gave it
    pub async fn register(&self, bot: UserId, registration: &str) -> Result<(), ApiError> {
        let now = now_millis();
        let Some(claims) = self.tokens.registration(registration, now) else {
            return Err(ApiError::new(400, "Invalid registration"));
        };
        if claims.bot != bot {
            return Err(ApiError::new(403, "Another bot's game"));
        }
        let _guard = self.lock(&claims.game).await;
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
        let applied = match found.apply(args.status, args.result, &args.remove, args.state, now_millis()) {
            Ok(applied) => applied,
            Err(UpdateError::Finished) => return Err(ApiError::new(409, "The game has finished")),
            Err(UpdateError::Invalid(message)) => return Err(ApiError::new(400, &message)),
        };
        self.store.put(&found).await.map_err(store_error)?;

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

    // Ends the games whose bots haven't updated them for a day
    pub async fn end_abandoned_games(self: &Arc<Self>) {
        let now = now_millis();
        let games = match self.store.idle_since(now - ABANDONED_AFTER).await {
            Ok(games) => games,
            Err(error) => return error!(%error, "Failed to list idle games"),
        };
        for game in games {
            let _guard = self.lock(&game).await;
            let Ok(Some(mut found)) = self.store.get(&game).await else {
                continue;
            };
            // A finished game whose card is yet to be written is just written again
            if found.status != GameStatus::Finished {
                if found.last_bot_update >= now - ABANDONED_AFTER {
                    continue;
                }
                info!(game = ?game, "Ending an abandoned game");
                found.abandon();
                if let Err(error) = self.store.put(&found).await {
                    error!(%error, "Failed to end an abandoned game");
                    continue;
                }
                self.hub.push_card(found.card(self.hub.watching(&game)));
            }
            self.write_card(game);
        }
    }

    // Writes the game's status to its card, now, or once the write in flight is done
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

    async fn write_card_until_done(&self, game: MiniAppGame) {
        let mut delay = Duration::from_secs(1);
        loop {
            let found = match self.store.get(&game).await {
                Ok(Some(found)) => found,
                Ok(None) => return,
                Err(error) => {
                    warn!(%error, "Failed to read a game to write its card");
                    tokio::time::sleep(delay).await;
                    delay = (delay * 2).min(MAX_WRITE_DELAY);
                    continue;
                }
            };
            match self.cards.write(found.bot_api_gateway, &game, found.card_status()).await {
                Ok(()) => {
                    if found.status == GameStatus::Finished {
                        self.end(&game).await;
                    }
                    return;
                }
                Err(WriteError::BotUninstalled) => {
                    // Writes the game as finished, which is let through
                    let _guard = self.lock(&game).await;
                    let Ok(Some(mut found)) = self.store.get(&game).await else {
                        return;
                    };
                    info!(game = ?game, "Ending a game whose bot was uninstalled");
                    found.abandon();
                    if self.store.put(&found).await.is_ok() {
                        self.hub.push_card(found.card(self.hub.watching(&game)));
                    }
                }
                Err(WriteError::CardDeleted) => {
                    info!(game = ?game, "Ending a game whose card was deleted");
                    self.end(&game).await;
                    return;
                }
                Err(WriteError::Refused(error)) => {
                    error!(game = ?game, error, "OpenChat refused a card write");
                    if found.status == GameStatus::Finished {
                        self.end(&game).await;
                    }
                    return;
                }
                Err(WriteError::Failed(error)) => {
                    warn!(game = ?game, error, "Failed to write a card, retrying");
                    tokio::time::sleep(delay).await;
                    delay = (delay * 2).min(MAX_WRITE_DELAY);
                }
            }
        }
    }

    // A game is forgotten once it's over and its card says so, or the card's gone
    async fn end(&self, game: &MiniAppGame) {
        if let Err(error) = self.store.delete(game).await {
            error!(%error, "Failed to delete an ended game");
        }
        self.hub.end(game);
    }

    pub async fn push_card(&self, game: &MiniAppGame) {
        if let Ok(Some(found)) = self.store.get(game).await {
            self.hub.push_card(found.card(self.hub.watching(game)));
        }
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

fn refused(id: RequestId, reason: Refusal) -> ServerMessage {
    ServerMessage::Refused {
        id,
        reason,
        message: None,
    }
}

fn unavailable(id: RequestId, error: types::Error) -> ServerMessage {
    error!(%error, "Failed to read or save a game");
    refused(id, Refusal::Unavailable)
}

fn store_error(error: types::Error) -> ApiError {
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
    use tokio::sync::mpsc::{UnboundedReceiver, unbounded_channel};
    use types::{
        CLAIM_TYPE_MINI_APP_CHAT, CLAIM_TYPE_MINI_APP_REGISTRATION, CanisterId, Chat, MiniAppActive, MiniAppFinished,
        MiniAppRegistrationClaims, MiniAppStatus,
    };

    const HOUR: Milliseconds = 60 * 60 * 1000;

    struct FakeBot {
        // How the bot answers each join request
        answer: Mutex<JoinOutcome>,
        joined: Mutex<Vec<UserId>>,
        left: Mutex<Vec<UserId>>,
    }

    #[async_trait]
    impl BotClient for FakeBot {
        async fn join(&self, _game: &Game, user_id: UserId) -> JoinOutcome {
            self.joined.lock().unwrap().push(user_id);
            match &*self.answer.lock().unwrap() {
                JoinOutcome::Accepted => JoinOutcome::Accepted,
                JoinOutcome::Refused(message) => JoinOutcome::Refused(message.clone()),
                JoinOutcome::Unavailable => JoinOutcome::Unavailable,
            }
        }

        async fn leave(&self, _game: &Game, user_id: UserId) -> Result<(), types::Error> {
            self.left.lock().unwrap().push(user_id);
            Ok(())
        }
    }

    #[derive(Default)]
    struct FakeCards {
        written: Mutex<Vec<MiniAppStatus>>,
        bot_uninstalled: Mutex<bool>,
    }

    #[async_trait]
    impl CardWriter for FakeCards {
        async fn write(&self, _gateway: CanisterId, _game: &MiniAppGame, status: MiniAppStatus) -> Result<(), WriteError> {
            if *self.bot_uninstalled.lock().unwrap() && !matches!(status, MiniAppStatus::Finished(_)) {
                return Err(WriteError::BotUninstalled);
            }
            self.written.lock().unwrap().push(status);
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

    const BOT: u8 = 100;

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

    impl Test {
        fn new() -> Test {
            let oc = P256KeyPair::new(&mut rand::rng());
            let bot = Arc::new(FakeBot {
                answer: Mutex::new(JoinOutcome::Accepted),
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

        async fn register(&self, max_players: Option<u32>, spectators: bool) {
            let registration = oc_token(
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
            );
            self.app.register(user(BOT), &registration).await.unwrap();
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

        fn connect(&self, user_id: UserId) -> (ConnectionId, UnboundedReceiver<ServerMessage>) {
            let (sender, receiver) = unbounded_channel();
            (self.app.hub.connect(user_id, sender), receiver)
        }

        async fn join(&self, user_id: UserId) -> ServerMessage {
            self.app.join(user_id, 1, &self.chat_token(user_id, true), game()).await
        }

        async fn update(&self, status: Option<GameStatus>, result: Option<&str>) -> Result<(), ApiError> {
            self.app
                .update(
                    user(BOT),
                    UpdateArgs {
                        game: game(),
                        status,
                        result: result.map(|r| r.to_string()),
                        remove: Vec::new(),
                        state: None,
                    },
                )
                .await
        }

        async fn stored(&self) -> Option<Game> {
            self.store.get(&game()).await.unwrap()
        }

        // Lets the spawned card writes run
        async fn settle(&self) {
            for _ in 0..10 {
                tokio::task::yield_now().await;
            }
        }
    }

    fn cards(receiver: &mut UnboundedReceiver<ServerMessage>) -> Vec<Card> {
        let mut cards = Vec::new();
        while let Ok(message) = receiver.try_recv() {
            if let ServerMessage::Card(card) = message {
                cards.push(card);
            }
        }
        cards
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
        *test.bot.answer.lock().unwrap() = JoinOutcome::Unavailable;
        assert!(matches!(
            test.join(user(1)).await,
            ServerMessage::Refused {
                reason: Refusal::BotUnavailable,
                ..
            }
        ));
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

    // The card in the chat records the players the game started with, then its result, after which
    // the service forgets the game
    #[tokio::test]
    async fn the_card_is_written_when_the_game_starts_and_when_it_finishes() {
        let test = Test::new();
        test.register(None, true).await;
        test.join(user(1)).await;
        test.join(user(2)).await;

        test.update(Some(GameStatus::Active), None).await.unwrap();
        test.settle().await;
        assert!(matches!(
            test.join(user(3)).await,
            ServerMessage::Refused {
                reason: Refusal::NotOpen,
                ..
            }
        ));

        test.update(Some(GameStatus::Finished), Some("Bob won")).await.unwrap();
        test.settle().await;
        assert_eq!(
            *test.cards.written.lock().unwrap(),
            vec![
                MiniAppStatus::Active(MiniAppActive {
                    players: vec![user(1), user(2)]
                }),
                MiniAppStatus::Finished(MiniAppFinished {
                    players: vec![user(1), user(2)],
                    result: Some("Bob won".to_string()),
                }),
            ]
        );
        assert!(test.stored().await.is_none());
        assert_eq!(test.update(None, None).await.unwrap_err().status, 404);
    }

    #[tokio::test]
    async fn a_game_ends_when_its_bot_is_uninstalled() {
        let test = Test::new();
        test.register(None, true).await;
        test.join(user(1)).await;
        *test.cards.bot_uninstalled.lock().unwrap() = true;

        test.update(Some(GameStatus::Active), None).await.unwrap();
        test.settle().await;
        assert_eq!(
            *test.cards.written.lock().unwrap(),
            vec![MiniAppStatus::Finished(MiniAppFinished {
                players: vec![user(1)],
                result: None,
            })]
        );
        assert!(test.stored().await.is_none());
    }

    #[tokio::test]
    async fn only_the_games_bot_updates_it() {
        let test = Test::new();
        test.register(None, true).await;
        let error = test
            .app
            .update(
                user(101),
                UpdateArgs {
                    game: game(),
                    status: Some(GameStatus::Active),
                    result: None,
                    remove: Vec::new(),
                    state: None,
                },
            )
            .await
            .unwrap_err();
        assert_eq!(error.status, 403);
        assert_eq!(test.update(Some(GameStatus::Open), Some("x")).await.unwrap_err().status, 400);
        assert_eq!(test.stored().await.unwrap().status, GameStatus::Open);
    }

    // A player gets their token and their own part of the state, a spectator the shared part, and is
    // counted on the card
    #[tokio::test]
    async fn players_and_spectators_open_the_game() {
        let test = Test::new();
        test.register(None, true).await;
        test.join(user(1)).await;
        let state = GameState {
            seq: 1,
            shared: json!({ "turn": 0 }),
            private: HashMap::from([(user(1), json!({ "hand": [1] }))]),
        };
        test.app
            .update(
                user(BOT),
                UpdateArgs {
                    game: game(),
                    status: None,
                    result: None,
                    remove: Vec::new(),
                    state: Some(state),
                },
            )
            .await
            .unwrap();

        let (player, mut player_messages) = test.connect(user(1));
        test.app
            .open(player, user(1), 1, &test.chat_token(user(1), true), game())
            .await;
        assert!(matches!(
            player_messages.try_recv(),
            Ok(ServerMessage::Opened {
                role: Role::Player,
                player_token: Some(_),
                ..
            })
        ));
        assert!(matches!(
            player_messages.try_recv(),
            Ok(ServerMessage::State { private: Some(_), .. })
        ));

        let (follower, mut follower_messages) = test.connect(user(3));
        test.app
            .follow(follower, user(3), 1, &test.chat_token(user(3), false), vec![game()])
            .await;
        cards(&mut follower_messages);
        let (spectator, mut spectator_messages) = test.connect(user(2));
        test.app
            .open(spectator, user(2), 1, &test.chat_token(user(2), false), game())
            .await;
        assert!(matches!(
            spectator_messages.try_recv(),
            Ok(ServerMessage::Opened {
                role: Role::Spectator,
                player_token: None,
                ..
            })
        ));
        assert!(matches!(
            spectator_messages.try_recv(),
            Ok(ServerMessage::State { private: None, .. })
        ));
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

    #[tokio::test]
    async fn a_game_closed_to_spectators_opens_only_for_its_players() {
        let test = Test::new();
        test.register(None, false).await;
        let (spectator, mut messages) = test.connect(user(2));
        test.app
            .open(spectator, user(2), 1, &test.chat_token(user(2), true), game())
            .await;
        assert!(matches!(
            messages.try_recv(),
            Ok(ServerMessage::Refused {
                reason: Refusal::NoSpectators,
                ..
            })
        ));
    }

    #[tokio::test]
    async fn a_player_leaves_and_the_bot_is_told() {
        let test = Test::new();
        test.register(None, true).await;
        test.join(user(1)).await;

        assert_eq!(test.app.leave(user(1), 1, game()).await, ServerMessage::Ok { id: 1 });
        test.settle().await;
        assert!(test.stored().await.unwrap().players.is_empty());
        assert_eq!(*test.bot.left.lock().unwrap(), vec![user(1)]);
    }

    #[tokio::test]
    async fn an_abandoned_game_ends() {
        let test = Test::new();
        test.register(None, true).await;
        test.join(user(1)).await;
        let mut stored = test.stored().await.unwrap();
        stored.last_bot_update = now_millis() - ABANDONED_AFTER - 1;
        test.store.put(&stored).await.unwrap();

        test.app.end_abandoned_games().await;
        test.settle().await;
        assert_eq!(
            *test.cards.written.lock().unwrap(),
            vec![MiniAppStatus::Finished(MiniAppFinished {
                players: Vec::new(),
                result: None,
            })]
        );
        assert!(test.stored().await.is_none());
    }

    #[tokio::test]
    async fn a_bot_registers_only_its_own_games() {
        let test = Test::new();
        let registration = oc_token(
            &test.oc,
            CLAIM_TYPE_MINI_APP_REGISTRATION,
            MiniAppRegistrationClaims {
                bot: user(BOT),
                bot_endpoint: "https://uno.example.com".to_string(),
                bot_api_gateway: Principal::from_slice(&[200]),
                game: game(),
                max_players: None,
                spectators: true,
            },
            now_millis() + HOUR,
        );
        assert_eq!(test.app.register(user(101), &registration).await.unwrap_err().status, 403);
        assert_eq!(test.app.register(user(BOT), "nonsense").await.unwrap_err().status, 400);
        test.app.register(user(BOT), &registration).await.unwrap();
        test.app.register(user(BOT), &registration).await.unwrap();
        assert!(test.stored().await.is_some());
    }
}
