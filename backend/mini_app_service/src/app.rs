// What the service does: the website's requests over its WebSocket, the bots' calls, and keeping the
// cards in the chats up to date
use crate::bots::{BotClient, JoinOutcome, StartOutcome};
use crate::cards::{CardWriter, PostError, WriteError};
use crate::games::{BotUpdate, Game, UpdateError};
use crate::hub::{ConnectionId, Hub};
use crate::now_millis;
use crate::protocol::{ClientMessage, GameStatus, PostArgs, Refusal, RequestId, Role, ServerMessage, UpdateArgs};
use crate::store::Store;
use crate::tokens::Tokens;
use std::collections::HashSet;
use std::hash::{DefaultHasher, Hash, Hasher};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::{Mutex as AsyncMutex, MutexGuard};
use tracing::{error, info, warn};
use types::{
    Error, Milliseconds, MiniAppChatClaims, MiniAppEnded, MiniAppGame, MiniAppSize, MiniAppStatusUpdate, TimestampMillis,
    UserId,
};

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
    // Changes to a game happen one at a time: joins, leaves, starts, its bot's updates and its card's
    // writes. None is held while a bot's asked to accept a player, but one is while it's asked to start,
    // for up to its timeout, which holds up the games sharing the lock too.
    locks: Vec<AsyncMutex<()>>,
    card_writes: Mutex<CardWrites>,
    // The games whose cards OpenChat couldn't take, being posted again
    posts: Mutex<HashSet<MiniAppGame>>,
    // The users whose joins are being answered by bots, who a bot may start a game with
    joining: Mutex<Vec<(MiniAppGame, UserId)>>,
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
            posts: Mutex::default(),
            joining: Mutex::default(),
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
            ClientMessage::Start { id: request, game } => {
                let reply = self.start(user_id, request, game).await;
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
            if let Ok(Some(found)) = self.known(&game).await {
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

        let found = match self.known(&game).await {
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
        self.joining.lock().unwrap().push((game, user_id));
        let outcome = self.bots.join(&found, user_id).await;
        let _guard = self.lock(&game).await;
        // A player started the game while the bot was answering, and the bot started it with this user
        if !self.stop_joining(&game, user_id) {
            return self.joined(request, &found, user_id);
        }

        let mut latest = match self.known(&game).await {
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
        // Their join from another tab went through
        if latest.is_player(user_id) {
            return self.joined(request, &latest, user_id);
        }
        match outcome {
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
                self.tell_bot_left(latest, user_id);
                return refused(request, Refusal::BotUnavailable);
            }
        }
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

    // Whether the user was still joining, rather than a start having taken them in
    fn stop_joining(&self, game: &MiniAppGame, user_id: UserId) -> bool {
        let mut joining = self.joining.lock().unwrap();
        let index = joining.iter().position(|j| *j == (*game, user_id));
        index.map(|index| joining.swap_remove(index)).is_some()
    }

    // A player asks to start the game. The bot's asked holding the game's lock, so no one joins or leaves
    // meanwhile, but for joins it's still answering, whom it may start the game with, having accepted
    // them. Their joins then succeed as they finish.
    async fn start(self: &Arc<Self>, user_id: UserId, request: RequestId, game: MiniAppGame) -> ServerMessage {
        let _guard = self.lock(&game).await;
        let mut found = match self.known(&game).await {
            Ok(Some(found)) => found,
            Ok(None) => return refused(request, Refusal::UnknownGame),
            Err(error) => return unavailable(request, error),
        };
        if !found.is_player(user_id) {
            return refused(request, Refusal::NotAPlayer);
        }
        if found.status != GameStatus::Open {
            return refused(request, Refusal::NotOpen);
        }
        let started = match self.bots.start(&found, user_id).await {
            StartOutcome::Accepted(started) => started,
            StartOutcome::Refused(message) => {
                return ServerMessage::Refused {
                    id: request,
                    reason: Refusal::RefusedByBot,
                    message,
                };
            }
            StartOutcome::Unavailable => return refused(request, Refusal::BotUnavailable),
        };
        let joining: Vec<_> = self
            .joining
            .lock()
            .unwrap()
            .iter()
            .filter(|(g, _)| *g == game)
            .map(|(_, user_id)| *user_id)
            .collect();
        let changes = match found.start(started, &joining, now_millis()) {
            Ok(changes) => changes,
            Err(message) => {
                warn!(bot = %found.bot, %message, "Bot started a game as it can't");
                return refused(request, Refusal::BotUnavailable);
            }
        };
        // The bot's asked again if the player tries again
        if let Err(error) = self.store.put(&found).await {
            return unavailable(request, error);
        }
        self.joining
            .lock()
            .unwrap()
            .retain(|(g, user_id)| *g != game || !changes.added.contains(user_id));

        for user_id in changes.not_joined {
            self.tell_bot_left(found.clone(), user_id);
        }
        for user_id in changes.removed {
            self.role_changed(&found, user_id, false);
        }
        for user_id in changes.added {
            self.role_changed(&found, user_id, true);
        }
        if changes.new_state
            && let Some(state) = &found.state
        {
            self.hub.push_state(game, state);
        }
        self.hub.push_card(found.card(self.hub.watching(&game)));
        self.write_card(game);
        ServerMessage::Ok { id: request }
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
        let found = match self.known(&game).await {
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
        // Read again, so a state pushed, or a join, before the connection was open isn't missed
        if let Ok(Some(latest)) = self.known(&game).await {
            if latest.is_player(user_id) != (role == Role::Player) {
                self.role_changed(&latest, user_id, latest.is_player(user_id));
            } else if let Some(state) = &latest.state {
                self.hub.send_latest_state(&[id], game, state, role);
            }
        }
        if watching_changed {
            self.push_card(&game).await;
        }
    }

    async fn player_token(&self, user_id: UserId, request: RequestId, game: MiniAppGame) -> ServerMessage {
        match self.known(&game).await {
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
            let mut found = match self.known(&game).await {
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

    // A bot posting a card, with its post token. The service posts the card as the bot, through the
    // LocalUserIndex, so it knows the game from the moment the card exists. The token fixes the card's
    // message id, and the chat answers a repeated card with the one it holds, so posting again posts
    // nothing new. Nothing is held while OpenChat is called.
    pub async fn post(self: &Arc<Self>, bot: UserId, args: PostArgs) -> Result<MiniAppGame, ApiError> {
        let now = now_millis();
        let Some(claims) = self.tokens.post(&args.token, now) else {
            return Err(ApiError::new(400, "Invalid post token"));
        };
        if claims.bot != bot {
            return Err(ApiError::new(403, "Another bot's token"));
        }
        let game = claims.game;
        args.card.to_content().map_err(|error| ApiError::new(400, &error))?;

        let pending = {
            let _guard = self.lock(&game).await;
            if self.store.has_ended(&game).await.map_err(store_error)? {
                return Err(ApiError::new(409, "The game has finished"));
            }
            match self.store.get(&game).await.map_err(store_error)? {
                Some(found) if found.bot != bot => return Err(ApiError::new(403, "Another bot's game")),
                Some(found) if found.is_posted() => return Ok(game),
                // Posted again before an earlier post was answered, eg. as the service restarted: that
                // post goes again
                Some(found) => found,
                None => {
                    let pending = Game::posting(claims, args, now);
                    self.store.put(&pending).await.map_err(store_error)?;
                    pending
                }
            }
        };
        match self.post_pending(&pending).await {
            Ok(()) => Ok(game),
            Err(PostError::Refused(error)) => Err(ApiError::new(400, &format!("OpenChat refused the card: {error}"))),
            Err(PostError::Failed(_)) => {
                self.retry_post(game);
                Err(ApiError::new(
                    503,
                    "Couldn't reach OpenChat; the service keeps trying, and the same token can be posted again",
                ))
            }
        }
    }

    // Sends a pending post to OpenChat once. A card OpenChat took is marked posted, one it refused is
    // forgotten, and one it couldn't take is left pending.
    async fn post_pending(&self, pending: &Game) -> Result<(), PostError> {
        let game = pending.game;
        let Some(post) = &pending.pending_post else {
            return Ok(());
        };
        let content = post.card.to_content().map_err(PostError::Refused)?;
        let result = self
            .cards
            .post(
                pending.bot_api_gateway,
                &post.token,
                content,
                post.block_level_markdown,
                post.replies_to,
            )
            .await;
        match result {
            Ok(()) => {
                info!(bot = %pending.bot, game = ?game, "Card posted");
                self.mark_posted(pending)
                    .await
                    .map_err(|error| PostError::Failed(error.to_string()))
            }
            Err(PostError::Refused(error)) => {
                info!(bot = %pending.bot, game = ?game, error, "OpenChat refused a card");
                self.forget_pending(pending).await;
                Err(PostError::Refused(error))
            }
            Err(PostError::Failed(error)) => {
                warn!(bot = %pending.bot, game = ?game, error, "Failed to post a card");
                Err(PostError::Failed(error))
            }
        }
    }

    // The card's in the chat, so the game is kept, as posted, whatever happened to its record meanwhile,
    // eg. a concurrent attempt was refused and forgot it
    async fn mark_posted(&self, pending: &Game) -> Result<(), Error> {
        let game = pending.game;
        let _guard = self.lock(&game).await;
        let mut found = self.store.get(&game).await?.unwrap_or_else(|| pending.clone());
        found.pending_post = None;
        self.store.put(&found).await?;
        // Followers who found the game pending get their first card
        self.hub.push_card(found.card(self.hub.watching(&game)));
        Ok(())
    }

    // A post OpenChat refused, or whose token expired: the game's forgotten, unless a concurrent attempt
    // got the card in. In case the card landed unheard, eg. before the bot's permission was taken away,
    // it's ended, so it doesn't stay Open with no game behind it. A card which never landed answers
    // MessageNotFound, which is nothing.
    async fn forget_pending(&self, pending: &Game) {
        let game = pending.game;
        let Some(post) = &pending.pending_post else {
            return;
        };
        {
            let _guard = self.lock(&game).await;
            match self.store.get(&game).await {
                Ok(Some(found)) if found.pending_post.as_ref().is_some_and(|p| p.token == post.token) => {
                    if let Err(error) = self.store.forget(&game).await {
                        error!(%error, "Failed to forget a game");
                        return;
                    }
                }
                Ok(_) => return,
                Err(error) => {
                    error!(%error, "Failed to read a game");
                    return;
                }
            }
        }
        let cards = self.cards.clone();
        let gateway = pending.bot_api_gateway;
        tokio::spawn(async move {
            let _ = cards
                .write(gateway, &game, MiniAppStatusUpdate::Ended(MiniAppEnded { result: None }))
                .await;
        });
    }

    // Keeps trying a post OpenChat couldn't take, backing off, until it's taken or refused or its token
    // expires. One at a time per game.
    fn retry_post(self: &Arc<Self>, game: MiniAppGame) {
        if !self.posts.lock().unwrap().insert(game) {
            return;
        }
        let app = self.clone();
        tokio::spawn(async move {
            let mut retry = Retry::new();
            while retry.wait().await {
                let found = match app.store.get(&game).await {
                    Ok(Some(found)) if !found.is_posted() => found,
                    Ok(_) => break,
                    Err(error) => {
                        warn!(%error, "Failed to read a game to post its card");
                        continue;
                    }
                };
                let expired = found
                    .pending_post
                    .as_ref()
                    .is_none_or(|post| app.tokens.post(&post.token, now_millis()).is_none());
                if expired {
                    info!(game = ?game, "Forgetting a card whose post token expired");
                    app.forget_pending(&found).await;
                    break;
                }
                match app.post_pending(&found).await {
                    Ok(()) | Err(PostError::Refused(_)) => break,
                    Err(PostError::Failed(_)) => {}
                }
            }
            app.posts.lock().unwrap().remove(&game);
        });
    }

    // A game whose card OpenChat has taken. Until then no one can follow, join or open it, nor its bot
    // update it.
    async fn known(&self, game: &MiniAppGame) -> Result<Option<Game>, Error> {
        Ok(self.store.get(game).await?.filter(Game::is_posted))
    }

    // A bot's update to one of its games
    pub async fn update(self: &Arc<Self>, bot: UserId, args: UpdateArgs) -> Result<(), ApiError> {
        let game = args.game;
        let _guard = self.lock(&game).await;
        let mut found = match self.known(&game).await {
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

    // Run on starting and then every few minutes: posts again any card still pending, eg. as the service
    // restarted before OpenChat answered, ends the games whose bots haven't updated them for a day, and
    // writes any card which hasn't caught up with its game, eg. as the service restarted before writing
    // it
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
                if found.pending_post.is_some() {
                    drop(_guard);
                    self.retry_post(game);
                    continue;
                }
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
        let message = match role {
            Some(role) => ServerMessage::Role {
                game: found.game,
                role,
                player_token: (role == Role::Player).then(|| self.tokens.player(found.bot, found.game, user_id, now_millis())),
            },
            None => ServerMessage::Closed { game: found.game },
        };
        let (ids, _) = self.hub.set_role(found.game, user_id, role, message);
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
    use crate::bots::Started;
    use crate::protocol::CardContent;
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
        BotInitiator, CLAIM_TYPE_MINI_APP_CHAT, CLAIM_TYPE_MINI_APP_POST, CanisterId, Chat, EventIndex, MiniAppActive,
        MiniAppContent, MiniAppFinished, MiniAppPostClaims, MiniAppStatus, MiniAppStatusUpdate,
    };

    const HOUR: Milliseconds = 60 * 60 * 1000;
    const BOT: u8 = 100;

    struct FakeBot {
        // How the bot answers each join request
        answer: Mutex<JoinOutcome>,
        // How it answers a start, or, if none, starting with the game's players, the first's turn first
        start_answer: Mutex<Option<StartOutcome>>,
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

        async fn start(&self, game: &Game, _user_id: UserId) -> StartOutcome {
            self.start_answer.lock().unwrap().clone().unwrap_or_else(|| {
                StartOutcome::Accepted(Started {
                    players: game.players.clone(),
                    waiting_for: game.players.first().copied().into_iter().collect(),
                    state: None,
                })
            })
        }

        async fn leave(&self, _game: &Game, user_id: UserId) -> Result<(), Error> {
            self.left.lock().unwrap().push(user_id);
            Ok(())
        }
    }

    // The chat, which takes a card once per message id, and then takes or refuses an update as the
    // canister does
    struct FakeCards {
        card: Mutex<MiniAppContent>,
        // The tokens cards were posted with
        posted: Mutex<Vec<String>>,
        written: Mutex<Vec<MiniAppStatusUpdate>>,
        bot_uninstalled: Mutex<bool>,
        // How many posts, and how many writes, fail before they go through
        post_failures: Mutex<u32>,
        failures: Mutex<u32>,
        // Why the chat refuses a card, if it does
        refuse_post: Mutex<Option<String>>,
    }

    impl Default for FakeCards {
        fn default() -> FakeCards {
            FakeCards {
                card: Mutex::new(MiniAppContent {
                    text: "Uno".to_string(),
                    image: None,
                    max_players: None,
                    spectators: true,
                    app_size: MiniAppSize { width: 440, height: 740 },
                    status: MiniAppStatus::Open,
                }),
                posted: Mutex::default(),
                written: Mutex::default(),
                bot_uninstalled: Mutex::default(),
                post_failures: Mutex::default(),
                failures: Mutex::default(),
                refuse_post: Mutex::default(),
            }
        }
    }

    #[async_trait]
    impl CardWriter for FakeCards {
        async fn post(
            &self,
            _gateway: CanisterId,
            token: &str,
            content: MiniAppContent,
            _block_level_markdown: bool,
            _replies_to: Option<EventIndex>,
        ) -> Result<(), PostError> {
            {
                let mut failures = self.post_failures.lock().unwrap();
                if *failures > 0 {
                    *failures -= 1;
                    return Err(PostError::Failed("Stopped for an upgrade".to_string()));
                }
            }
            if let Some(error) = self.refuse_post.lock().unwrap().clone() {
                return Err(PostError::Refused(error));
            }
            // As the chat does: a bot's repeated card is the card it holds
            let mut posted = self.posted.lock().unwrap();
            if !posted.iter().any(|t| t == token) {
                posted.push(token.to_string());
                *self.card.lock().unwrap() = content;
            }
            Ok(())
        }

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

    fn post_claims(bot: UserId) -> MiniAppPostClaims {
        MiniAppPostClaims {
            bot,
            bot_endpoint: "https://uno.example.com".to_string(),
            bot_api_gateway: Principal::from_slice(&[200]),
            game: game(),
            initiator: BotInitiator::Autonomous,
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
                start_answer: Mutex::default(),
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

        // The bot's permission to post the test's game, as the LocalUserIndex would sign it
        fn post_token(&self) -> String {
            self.post_token_for(user(BOT))
        }

        fn post_token_for(&self, bot: UserId) -> String {
            oc_token(&self.oc, CLAIM_TYPE_MINI_APP_POST, post_claims(bot), now_millis() + HOUR)
        }

        fn post_args(&self, max_players: Option<u32>, spectators: bool) -> PostArgs {
            PostArgs {
                token: self.post_token(),
                card: CardContent {
                    text: "Uno".to_string(),
                    image: None,
                    max_players,
                    spectators,
                    app_size: MiniAppSize { width: 440, height: 740 },
                },
                block_level_markdown: false,
                replies_to: None,
            }
        }

        // The bot posts the test's game, and the chat takes the card
        async fn post(&self, max_players: Option<u32>, spectators: bool) {
            assert_eq!(
                self.app.post(user(BOT), self.post_args(max_players, spectators)).await,
                Ok(game())
            );
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

        async fn start(&self, user_id: UserId) -> ServerMessage {
            self.app.start(user_id, 1, game()).await
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
        test.post(Some(4), true).await;
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
        test.post(Some(1), true).await;

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

    // So a bot can update its game before it answers. If the game's changed meanwhile, eg. it started
    // without them, the join's refused, and the bot's told the user isn't playing.
    #[tokio::test]
    async fn a_join_doesnt_hold_up_the_game_while_the_bot_answers() {
        let test = Test::new();
        test.post(None, true).await;
        test.join(user(2)).await;
        let gate = Arc::new(Notify::new());
        *test.bot.gate.lock().unwrap() = Some(gate.clone());

        let app = test.app.clone();
        let chat_token = test.chat_token(user(1), true);
        let join = tokio::spawn(async move { app.join(user(1), 1, &chat_token, game()).await });
        test.settle().await;

        test.update(UpdateArgs {
            state: Some(GameState {
                seq: 1,
                shared: json!({}),
                private: HashMap::new(),
            }),
            ..update(None)
        })
        .await
        .unwrap();
        assert_eq!(test.start(user(2)).await, ServerMessage::Ok { id: 1 });
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
    // result, after which the service forgets the game, and doesn't let its bot post its card again
    #[tokio::test]
    async fn the_card_follows_the_game_from_its_start_to_its_end() {
        let test = Test::new();
        test.post(None, true).await;
        test.join(user(1)).await;
        test.join(user(2)).await;

        assert_eq!(test.start(user(1)).await, ServerMessage::Ok { id: 1 });
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

        // Nor can its card be posted again
        assert_eq!(
            test.app.post(user(BOT), test.post_args(None, true)).await.unwrap_err().status,
            409
        );
        assert!(test.stored().await.is_none());
    }

    // The game finishing while its start is still being written: the card records who played, then the
    // result
    #[tokio::test(start_paused = true)]
    async fn the_card_catches_up_after_failed_writes() {
        let test = Test::new();
        test.post(None, true).await;
        test.join(user(1)).await;
        *test.cards.failures.lock().unwrap() = 2;

        test.start(user(1)).await;
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
        test.post(None, true).await;
        test.join(user(1)).await;
        *test.cards.bot_uninstalled.lock().unwrap() = true;

        test.start(user(1)).await;
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
        test.post(None, true).await;
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
        test.post(None, true).await;
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
        test.post(None, true).await;
        test.join(user(1)).await;
        let error = test
            .app
            .update(user(101), update(Some(GameStatus::Active)))
            .await
            .unwrap_err();
        assert_eq!(error.status, 403);
        for args in [
            // A game's started by a player, through the service
            update(Some(GameStatus::Active)),
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
        test.post(None, true).await;
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
        test.post(None, true).await;
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
            test.post(None, spectators).await;
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
        test.post(None, false).await;
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
        test.post(None, true).await;
        test.join(user(1)).await;

        assert_eq!(test.app.leave(user(1), 1, game()).await, ServerMessage::Ok { id: 1 });
        assert!(test.stored().await.unwrap().players.is_empty());
        assert_eq!(*test.bot.left.lock().unwrap(), vec![user(1)]);
    }

    // Only a player starts it, and only once, as the bot agrees
    #[tokio::test]
    async fn a_player_starts_the_game_if_the_bot_agrees() {
        let test = Test::new();
        test.post(None, true).await;
        test.join(user(1)).await;
        assert!(matches!(
            test.start(user(2)).await,
            ServerMessage::Refused {
                reason: Refusal::NotAPlayer,
                ..
            }
        ));

        *test.bot.start_answer.lock().unwrap() = Some(StartOutcome::Refused(Some("Needs 2 players".to_string())));
        assert_eq!(
            test.start(user(1)).await,
            ServerMessage::Refused {
                id: 1,
                reason: Refusal::RefusedByBot,
                message: Some("Needs 2 players".to_string()),
            }
        );
        assert_eq!(test.stored().await.unwrap().status, GameStatus::Open);

        *test.bot.start_answer.lock().unwrap() = None;
        assert_eq!(test.start(user(1)).await, ServerMessage::Ok { id: 1 });
        assert!(matches!(
            test.start(user(1)).await,
            ServerMessage::Refused {
                reason: Refusal::NotOpen,
                ..
            }
        ));
    }

    // The bot accepted them, so they play, and their join succeeds as it finishes
    #[tokio::test]
    async fn a_game_starts_with_a_player_whose_join_the_bot_is_still_answering() {
        let test = Test::new();
        test.post(None, true).await;
        test.join(user(2)).await;
        let gate = Arc::new(Notify::new());
        *test.bot.gate.lock().unwrap() = Some(gate.clone());
        let app = test.app.clone();
        let chat_token = test.chat_token(user(1), true);
        let join = tokio::spawn(async move { app.join(user(1), 1, &chat_token, game()).await });
        test.settle().await;

        *test.bot.start_answer.lock().unwrap() = Some(StartOutcome::Accepted(Started {
            players: vec![user(1), user(2)],
            waiting_for: vec![user(1)],
            state: None,
        }));
        assert_eq!(test.start(user(2)).await, ServerMessage::Ok { id: 1 });
        // The service's join order, then those still joining
        assert_eq!(test.stored().await.unwrap().started_with, vec![user(2), user(1)]);

        gate.notify_one();
        assert!(matches!(join.await.unwrap(), ServerMessage::Joined { .. }));
        test.settle().await;
        assert!(test.bot.left.lock().unwrap().is_empty());
        assert_eq!(test.card().players(), [user(2), user(1)]);
    }

    // Only users who asked to join through OpenChat play: anyone else in the bot's answer, eg. a player
    // whose leave hadn't reached the bot, isn't added, and the bot's told they left. Anyone playing whom
    // it leaves out is taken off.
    #[tokio::test]
    async fn a_game_starts_only_with_users_who_joined() {
        let test = Test::new();
        test.post(None, true).await;
        test.join(user(1)).await;
        test.join(user(2)).await;
        test.join(user(3)).await;
        test.app.leave(user(2), 1, game()).await;
        test.bot.left.lock().unwrap().clear();

        *test.bot.start_answer.lock().unwrap() = Some(StartOutcome::Accepted(Started {
            players: vec![user(1), user(2)],
            waiting_for: vec![user(2), user(1)],
            state: None,
        }));
        assert_eq!(test.start(user(1)).await, ServerMessage::Ok { id: 1 });
        test.settle().await;
        let stored = test.stored().await.unwrap();
        assert_eq!(stored.started_with, vec![user(1)]);
        assert_eq!(stored.waiting_for, vec![user(1)]);
        assert_eq!(*test.bot.left.lock().unwrap(), vec![user(2)]);
    }

    // It's told its role before the state, which has their own part if they're now playing
    #[tokio::test]
    async fn a_start_tells_open_apps_their_new_roles_then_sends_the_first_state() {
        let test = Test::new();
        test.post(None, true).await;
        test.join(user(1)).await;
        test.join(user(2)).await;
        let (tab1, mut tab1_messages) = test.connect(user(1));
        let (tab2, mut tab2_messages) = test.connect(user(2));
        test.app.open(tab1, user(1), 1, &test.chat_token(user(1), true), game()).await;
        test.app.open(tab2, user(2), 1, &test.chat_token(user(2), true), game()).await;
        messages(&mut tab1_messages);
        messages(&mut tab2_messages);

        *test.bot.start_answer.lock().unwrap() = Some(StartOutcome::Accepted(Started {
            players: vec![user(1)],
            waiting_for: vec![user(1)],
            state: Some(GameState {
                seq: 1,
                shared: json!({}),
                private: HashMap::from([(user(1), json!({ "hand": [1] })), (user(2), json!({ "hand": [2] }))]),
            }),
        }));
        assert_eq!(test.start(user(1)).await, ServerMessage::Ok { id: 1 });
        test.settle().await;

        let received = messages(&mut tab1_messages);
        assert!(received.iter().any(|m| matches!(
            m,
            ServerMessage::State {
                seq: 1,
                private: Some(_),
                ..
            }
        )));
        let received = messages(&mut tab2_messages);
        assert_eq!(
            received[0],
            ServerMessage::Role {
                game: game(),
                role: Role::Spectator,
                player_token: None,
            }
        );
        assert!(
            received
                .iter()
                .all(|m| !matches!(m, ServerMessage::State { private: Some(_), .. }))
        );
    }

    // The bot listed them, so it accepted them, whatever it answered to the join
    #[tokio::test]
    async fn a_join_the_bot_answered_badly_succeeds_if_the_game_started_with_them() {
        let test = Test::new();
        test.post(None, true).await;
        test.join(user(2)).await;
        let (tab, mut tab_messages) = test.connect(user(1));
        test.app.open(tab, user(1), 1, &test.chat_token(user(1), true), game()).await;
        messages(&mut tab_messages);
        *test.bot.answer.lock().unwrap() = JoinOutcome::Unavailable;
        let gate = Arc::new(Notify::new());
        *test.bot.gate.lock().unwrap() = Some(gate.clone());
        let app = test.app.clone();
        let chat_token = test.chat_token(user(1), true);
        let join = tokio::spawn(async move { app.join(user(1), 1, &chat_token, game()).await });
        test.settle().await;

        *test.bot.start_answer.lock().unwrap() = Some(StartOutcome::Accepted(Started {
            players: vec![user(2), user(1)],
            waiting_for: Vec::new(),
            state: None,
        }));
        assert_eq!(test.start(user(2)).await, ServerMessage::Ok { id: 1 });
        assert!(matches!(
            messages(&mut tab_messages)[0],
            ServerMessage::Role {
                role: Role::Player,
                player_token: Some(_),
                ..
            }
        ));

        gate.notify_one();
        assert!(matches!(join.await.unwrap(), ServerMessage::Joined { .. }));
        test.settle().await;
        assert!(test.bot.left.lock().unwrap().is_empty());
    }

    // As it's not the game's state, rather than drop it, so the players would see none
    #[tokio::test]
    async fn a_start_whose_state_isnt_newer_is_refused() {
        let test = Test::new();
        test.post(None, true).await;
        test.join(user(1)).await;
        let lobby = GameState {
            seq: 3,
            shared: json!({}),
            private: HashMap::new(),
        };
        test.update(UpdateArgs {
            state: Some(lobby.clone()),
            ..update(None)
        })
        .await
        .unwrap();

        *test.bot.start_answer.lock().unwrap() = Some(StartOutcome::Accepted(Started {
            players: vec![user(1)],
            waiting_for: Vec::new(),
            state: Some(lobby),
        }));
        assert!(matches!(
            test.start(user(1)).await,
            ServerMessage::Refused {
                reason: Refusal::BotUnavailable,
                ..
            }
        ));
        assert_eq!(test.stored().await.unwrap().status, GameStatus::Open);
    }

    // Once, however often the token's posted, so a bot which got no answer posts it again
    #[tokio::test]
    async fn a_bot_posts_its_card_through_the_service_once() {
        let test = Test::new();
        let args = test.post_args(Some(4), true);
        assert_eq!(test.app.post(user(BOT), args.clone()).await, Ok(game()));
        assert_eq!(test.app.post(user(BOT), args.clone()).await, Ok(game()));
        assert_eq!(test.cards.posted.lock().unwrap().len(), 1);
        let stored = test.stored().await.unwrap();
        assert!(stored.is_posted());
        assert_eq!(stored.max_players, Some(4));
        assert_eq!(test.cards.card.lock().unwrap().max_players, Some(4));

        assert_eq!(test.app.post(user(101), args.clone()).await.unwrap_err().status, 403);
        let other = test.post_token_for(user(101));
        assert_eq!(
            test.app
                .post(
                    user(BOT),
                    PostArgs {
                        token: other,
                        ..args.clone()
                    }
                )
                .await
                .unwrap_err()
                .status,
            403
        );
        let nonsense = PostArgs {
            token: "nonsense".to_string(),
            ..args.clone()
        };
        assert_eq!(test.app.post(user(BOT), nonsense).await.unwrap_err().status, 400);
    }

    // An invalid card, or one OpenChat refuses, isn't kept, so a bot can post a card for the same
    // command again once it's fixed
    #[tokio::test]
    async fn a_card_the_chat_wont_take_is_forgotten() {
        let test = Test::new();
        let mut args = test.post_args(None, true);
        args.card.text = String::new();
        let error = test.app.post(user(BOT), args).await.unwrap_err();
        assert_eq!(error.status, 400, "{error:?}");
        assert!(test.stored().await.is_none());

        *test.cards.refuse_post.lock().unwrap() = Some("Bot not installed".to_string());
        let error = test.app.post(user(BOT), test.post_args(None, true)).await.unwrap_err();
        assert_eq!(error.status, 400);
        assert!(error.message.contains("Bot not installed"), "{error:?}");
        assert!(test.stored().await.is_none());
    }

    // A card OpenChat couldn't take is pending, and unknown to everyone, until the service gets it in,
    // trying again with backoff, or the bot posts the same token again
    #[tokio::test(start_paused = true)]
    async fn a_card_the_chat_couldnt_take_is_posted_again() {
        let test = Test::new();
        *test.cards.post_failures.lock().unwrap() = 2;
        let args = test.post_args(None, true);
        assert_eq!(test.app.post(user(BOT), args.clone()).await.unwrap_err().status, 503);
        assert!(!test.stored().await.unwrap().is_posted());

        let refused = |message: &ServerMessage| {
            matches!(
                message,
                ServerMessage::Refused {
                    reason: Refusal::UnknownGame,
                    ..
                }
            )
        };
        assert!(refused(&test.join(user(1)).await));
        assert!(refused(&test.app.leave(user(1), 1, game()).await));
        assert!(refused(&test.app.player_token(user(1), 1, game()).await));
        assert!(refused(&test.app.start(user(1), 1, game()).await));
        let (id, mut received) = test.connect(user(1));
        test.app.open(id, user(1), 1, &test.chat_token(user(1), true), game()).await;
        assert!(refused(&messages(&mut received)[0]));
        test.app
            .follow(id, user(1), 2, &test.chat_token(user(1), true), vec![game()])
            .await;
        assert!(cards(&mut received).is_empty());
        assert_eq!(test.update(update(None)).await.unwrap_err().status, 404);

        // The service's own retries get it in, and the followers their card
        tokio::time::sleep(Duration::from_secs(10)).await;
        test.settle().await;
        assert!(test.stored().await.unwrap().is_posted());
        assert_eq!(test.cards.posted.lock().unwrap().len(), 1);
        assert_eq!(cards(&mut received).len(), 1);
        assert!(matches!(test.join(user(1)).await, ServerMessage::Joined { .. }));
        assert!(test.app.posts.lock().unwrap().is_empty());
    }

    // The chat took the card but the service didn't hear, eg. it restarted meanwhile: the chat answers
    // the repeated card with the one it holds
    #[tokio::test]
    async fn a_card_the_chat_took_unheard_is_confirmed_by_posting_again() {
        let test = Test::new();
        let args = test.post_args(None, true);
        test.cards.posted.lock().unwrap().push(args.token.clone());
        assert_eq!(test.app.post(user(BOT), args).await, Ok(game()));
        assert!(test.stored().await.unwrap().is_posted());
        assert_eq!(test.cards.posted.lock().unwrap().len(), 1);
    }

    // Two attempts at the same post can be in flight, the bot's and the service's. One getting the card
    // in wins: a refusal after it, eg. as the bot's permission was taken away between them, doesn't
    // forget the live game, and a success after the record was forgotten keeps the game.
    #[tokio::test]
    async fn a_posted_game_survives_a_late_refusal_and_a_forgotten_one_a_late_success() {
        let test = Test::new();
        let args = test.post_args(None, true);
        let as_read_before = Game::posting(post_claims(user(BOT)), args.clone(), now_millis());
        assert_eq!(test.app.post(user(BOT), args.clone()).await, Ok(game()));
        test.join(user(1)).await;

        *test.cards.refuse_post.lock().unwrap() = Some("Bot not installed".to_string());
        assert!(matches!(
            test.app.post_pending(&as_read_before).await,
            Err(PostError::Refused(_))
        ));
        let stored = test.stored().await.unwrap();
        assert!(stored.is_posted());
        assert_eq!(stored.players, vec![user(1)]);
        test.settle().await;
        assert!(test.cards.written.lock().unwrap().is_empty());

        let test = Test::new();
        let pending = Game::posting(post_claims(user(BOT)), test.post_args(None, true), now_millis());
        test.store.put(&pending).await.unwrap();
        test.app.forget_pending(&pending).await;
        assert!(test.stored().await.is_none());
        test.app.mark_posted(&pending).await.unwrap();
        assert!(test.stored().await.unwrap().is_posted());
    }

    // Whether the game's posted or still pending
    #[tokio::test]
    async fn another_bot_cant_post_over_a_games_record() {
        let test = Test::new();
        *test.cards.post_failures.lock().unwrap() = 1;
        let args = test.post_args(None, true);
        assert_eq!(test.app.post(user(BOT), args.clone()).await.unwrap_err().status, 503);
        let other = PostArgs {
            token: test.post_token_for(user(101)),
            ..args.clone()
        };
        assert_eq!(test.app.post(user(101), other.clone()).await.unwrap_err().status, 403);
        assert_eq!(test.stored().await.unwrap().bot, user(BOT));

        assert_eq!(test.app.post(user(BOT), args).await, Ok(game()));
        assert_eq!(test.app.post(user(101), other).await.unwrap_err().status, 403);
        assert_eq!(test.stored().await.unwrap().bot, user(BOT));
    }

    // The bot gets a new token then, as it has to post a new card. In case the card landed unheard, it's
    // ended. JWTs expire to the second, so the pending game is stored as a restart would leave it, with a
    // token which has since expired.
    #[tokio::test(start_paused = true)]
    async fn a_pending_card_whose_token_expired_is_forgotten_and_ended() {
        let test = Test::new();
        let mut args = test.post_args(None, true);
        args.token = oc_token(
            &test.oc,
            CLAIM_TYPE_MINI_APP_POST,
            post_claims(user(BOT)),
            now_millis() - 1_000,
        );
        test.store
            .put(&Game::posting(post_claims(user(BOT)), args, now_millis()))
            .await
            .unwrap();

        test.app.maintain().await;
        tokio::time::sleep(Duration::from_secs(2)).await;
        test.settle().await;
        assert!(test.stored().await.is_none());
        assert!(test.cards.posted.lock().unwrap().is_empty());
        assert!(matches!(
            test.cards.written.lock().unwrap().as_slice(),
            [MiniAppStatusUpdate::Ended(MiniAppEnded { result: None })]
        ));
    }
}
