// The website's connections: which cards each follows, which games each has open, and pushing them what
// changes. It's in memory, so a deploy drops every connection, which the website reopens.
use crate::protocol::{Card, GameState, Role, ServerMessage};
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::mpsc::Sender;
use tokio::time::Instant;
use tracing::info;
use types::{MiniAppGame, UserId};

pub type ConnectionId = u64;

// Spectators get at most this many updates a second, the latest when they come faster
const SPECTATOR_INTERVAL: Duration = Duration::from_millis(250);

#[derive(Default)]
pub struct Hub {
    inner: Mutex<HubInner>,
}

#[derive(Default)]
struct HubInner {
    next_id: ConnectionId,
    connections: HashMap<ConnectionId, Connection>,
    followers: HashMap<MiniAppGame, HashSet<ConnectionId>>,
    openers: HashMap<MiniAppGame, HashMap<ConnectionId, Role>>,
    spectator_feeds: HashMap<MiniAppGame, SpectatorFeed>,
}

struct Connection {
    user_id: UserId,
    // Bounded, so a connection which stops reading is dropped rather than queuing without end
    sender: Sender<Arc<ServerMessage>>,
    following: HashSet<MiniAppGame>,
    open: HashSet<MiniAppGame>,
}

struct SpectatorFeed {
    last_sent: Instant,
    // The latest state, held back until the spectators can have it
    pending: Option<GameState>,
}

impl Hub {
    pub fn connect(&self, user_id: UserId, sender: Sender<Arc<ServerMessage>>) -> ConnectionId {
        let mut inner = self.inner.lock().unwrap();
        inner.next_id += 1;
        let id = inner.next_id;
        inner.connections.insert(
            id,
            Connection {
                user_id,
                sender,
                following: HashSet::new(),
                open: HashSet::new(),
            },
        );
        id
    }

    // Returns the games someone stopped watching, whose cards' counts changed
    pub fn disconnect(&self, id: ConnectionId) -> Vec<MiniAppGame> {
        self.inner.lock().unwrap().disconnect(id)
    }

    pub fn send(&self, id: ConnectionId, message: ServerMessage) {
        self.inner.lock().unwrap().send_to(id, Arc::new(message));
    }

    pub fn follow(&self, id: ConnectionId, games: &[MiniAppGame]) {
        let mut inner = self.inner.lock().unwrap();
        let Some(connection) = inner.connections.get_mut(&id) else {
            return;
        };
        connection.following.extend(games.iter().copied());
        for game in games {
            inner.followers.entry(*game).or_default().insert(id);
        }
    }

    pub fn unfollow(&self, id: ConnectionId, games: &[MiniAppGame]) {
        let mut inner = self.inner.lock().unwrap();
        if let Some(connection) = inner.connections.get_mut(&id) {
            for game in games {
                connection.following.remove(game);
            }
        }
        for game in games {
            inner.unfollow(id, game);
        }
    }

    // Whether the number watching changed
    pub fn open(&self, id: ConnectionId, game: MiniAppGame, role: Role) -> bool {
        let mut inner = self.inner.lock().unwrap();
        let Some(connection) = inner.connections.get_mut(&id) else {
            return false;
        };
        connection.open.insert(game);
        let before = inner.watching(&game);
        inner.openers.entry(game).or_default().insert(id, role);
        inner.watching(&game) != before
    }

    // Whether the number watching changed
    pub fn close(&self, id: ConnectionId, game: &MiniAppGame) -> bool {
        let mut inner = self.inner.lock().unwrap();
        let before = inner.watching(game);
        inner.close(id, game);
        inner.watching(game) != before
    }

    // A user's role changed, eg. they joined, left or were removed: their connections with the game
    // open take it, or close it if they can no longer watch, and are sent `message`, before anything
    // else is pushed to them in their new role. Returns those connections, and whether the number
    // watching changed.
    pub fn set_role(
        &self,
        game: MiniAppGame,
        user_id: UserId,
        role: Option<Role>,
        message: ServerMessage,
    ) -> (Vec<ConnectionId>, bool) {
        let mut inner = self.inner.lock().unwrap();
        let before = inner.watching(&game);
        let ids: Vec<_> = inner
            .openers
            .get(&game)
            .into_iter()
            .flatten()
            .map(|(id, _)| *id)
            .filter(|id| inner.connections.get(id).is_some_and(|c| c.user_id == user_id))
            .collect();
        let message = Arc::new(message);
        for id in &ids {
            match role {
                Some(role) => {
                    inner.openers.entry(game).or_default().insert(*id, role);
                }
                None => inner.close(*id, &game),
            }
            inner.send_to(*id, message.clone());
        }
        let changed = inner.watching(&game) != before;
        (ids, changed)
    }

    // How many people are watching, counted once however many times they have it open
    pub fn watching(&self, game: &MiniAppGame) -> u32 {
        self.inner.lock().unwrap().watching(game)
    }

    pub fn push_card(&self, card: Card) {
        let mut inner = self.inner.lock().unwrap();
        let ids: Vec<_> = inner.followers.get(&card.game).into_iter().flatten().copied().collect();
        let message = Arc::new(ServerMessage::Card(card));
        for id in ids {
            inner.send_to(id, message.clone());
        }
    }

    // Sends the state to everyone with the game open: each player their own part too, straight away,
    // and spectators the shared part, at most every `SPECTATOR_INTERVAL`
    pub fn push_state(self: &Arc<Self>, game: MiniAppGame, state: &GameState) {
        let mut inner = self.inner.lock().unwrap();
        inner.send_state(&game, state, Role::Player);

        let now = Instant::now();
        let feed = inner.spectator_feeds.entry(game).or_insert(SpectatorFeed {
            last_sent: now - SPECTATOR_INTERVAL,
            pending: None,
        });
        let send_now = now >= feed.last_sent + SPECTATOR_INTERVAL;
        // The first held back since the last sent arranges for the latest to go when it's due
        let send_at = if send_now {
            feed.last_sent = now;
            None
        } else {
            feed.pending
                .replace(state.clone())
                .is_none()
                .then_some(feed.last_sent + SPECTATOR_INTERVAL)
        };

        if send_now {
            inner.send_state(&game, state, Role::Spectator);
        }
        if let Some(due) = send_at {
            let hub = self.clone();
            tokio::spawn(async move {
                tokio::time::sleep_until(due).await;
                let mut inner = hub.inner.lock().unwrap();
                let pending = inner.spectator_feeds.get_mut(&game).and_then(|feed| {
                    feed.last_sent = Instant::now();
                    feed.pending.take()
                });
                if let Some(state) = pending {
                    inner.send_state(&game, &state, Role::Spectator);
                }
            });
        }
    }

    // A game which ended, which nothing more is pushed for
    pub fn end(&self, game: &MiniAppGame) {
        self.inner.lock().unwrap().spectator_feeds.remove(game);
    }

    // The game's latest state, for connections which just opened it or whose role changed
    pub fn send_latest_state(&self, ids: &[ConnectionId], game: MiniAppGame, state: &GameState, role: Role) {
        let mut inner = self.inner.lock().unwrap();
        for id in ids {
            if let Some(user_id) = inner.connections.get(id).map(|c| c.user_id) {
                inner.send_to(*id, Arc::new(state_message(game, state, user_id, role)));
            }
        }
    }
}

impl HubInner {
    // A connection whose queue is full has stopped reading, so is dropped
    fn send_to(&mut self, id: ConnectionId, message: Arc<ServerMessage>) {
        let Some(connection) = self.connections.get(&id) else {
            return;
        };
        if connection.sender.try_send(message).is_err() {
            info!(id, "Dropping a connection which stopped reading");
            self.disconnect(id);
        }
    }

    fn disconnect(&mut self, id: ConnectionId) -> Vec<MiniAppGame> {
        let Some(connection) = self.connections.remove(&id) else {
            return Vec::new();
        };
        for game in &connection.following {
            self.unfollow(id, game);
        }
        connection
            .open
            .iter()
            .filter(|game| self.close_opener(id, game) == Some(Role::Spectator))
            .copied()
            .collect()
    }

    fn unfollow(&mut self, id: ConnectionId, game: &MiniAppGame) {
        if let Some(followers) = self.followers.get_mut(game) {
            followers.remove(&id);
            if followers.is_empty() {
                self.followers.remove(game);
            }
        }
    }

    fn close(&mut self, id: ConnectionId, game: &MiniAppGame) {
        if let Some(connection) = self.connections.get_mut(&id) {
            connection.open.remove(game);
        }
        self.close_opener(id, game);
    }

    fn close_opener(&mut self, id: ConnectionId, game: &MiniAppGame) -> Option<Role> {
        let openers = self.openers.get_mut(game)?;
        let role = openers.remove(&id);
        if openers.is_empty() {
            self.openers.remove(game);
            self.spectator_feeds.remove(game);
        }
        role
    }

    fn watching(&self, game: &MiniAppGame) -> u32 {
        let Some(openers) = self.openers.get(game) else {
            return 0;
        };
        openers
            .iter()
            .filter(|(_, role)| **role == Role::Spectator)
            .filter_map(|(id, _)| self.connections.get(id).map(|c| c.user_id))
            .collect::<HashSet<_>>()
            .len() as u32
    }

    // Spectators all get the same message, so it's built once
    fn send_state(&mut self, game: &MiniAppGame, state: &GameState, to: Role) {
        let ids: Vec<_> = self
            .openers
            .get(game)
            .into_iter()
            .flatten()
            .filter(|(_, role)| **role == to)
            .map(|(id, _)| *id)
            .collect();
        let spectators_message = (to == Role::Spectator).then(|| {
            Arc::new(ServerMessage::State {
                game: *game,
                seq: state.seq,
                shared: state.shared.clone(),
                private: None,
            })
        });
        for id in ids {
            let Some(user_id) = self.connections.get(&id).map(|c| c.user_id) else {
                continue;
            };
            let message = match &spectators_message {
                Some(message) => message.clone(),
                None => Arc::new(state_message(*game, state, user_id, to)),
            };
            self.send_to(id, message);
        }
    }
}

fn state_message(game: MiniAppGame, state: &GameState, user_id: UserId, role: Role) -> ServerMessage {
    ServerMessage::State {
        game,
        seq: state.seq,
        shared: state.shared.clone(),
        private: match role {
            Role::Player => state.private.get(&user_id).cloned(),
            Role::Spectator => None,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use serde_json::json;
    use tokio::sync::mpsc::{Receiver, channel};
    use types::Chat;

    fn user(n: u8) -> UserId {
        Principal::from_slice(&[n]).into()
    }

    fn game() -> MiniAppGame {
        MiniAppGame {
            chat: Chat::Group(Principal::from_slice(&[9]).into()),
            thread: None,
            message_id: 7u64.into(),
        }
    }

    fn connect(hub: &Hub, user_id: UserId) -> (ConnectionId, Receiver<Arc<ServerMessage>>) {
        let (sender, receiver) = channel(16);
        (hub.connect(user_id, sender), receiver)
    }

    fn state(seq: u64) -> GameState {
        GameState {
            seq,
            shared: json!({ "seq": seq }),
            private: HashMap::from([(user(1), json!({ "hand": [seq] }))]),
        }
    }

    fn states(receiver: &mut Receiver<Arc<ServerMessage>>) -> Vec<(u64, Option<serde_json::Value>)> {
        let mut states = Vec::new();
        while let Ok(message) = receiver.try_recv() {
            if let ServerMessage::State { seq, private, .. } = &*message {
                states.push((*seq, private.clone()));
            }
        }
        states
    }

    fn card() -> Card {
        Card {
            game: game(),
            status: crate::protocol::GameStatus::Open,
            players: Vec::new(),
            waiting_for: Vec::new(),
            watching: 0,
            result: None,
        }
    }

    // Counted once however many tabs they have it open in, and not counting players
    #[test]
    fn spectators_are_counted_once_each() {
        let hub = Hub::default();
        let (a1, _r1) = connect(&hub, user(1));
        let (a2, _r2) = connect(&hub, user(1));
        let (b, _r3) = connect(&hub, user(2));

        assert!(hub.open(a1, game(), Role::Spectator));
        assert!(!hub.open(a2, game(), Role::Spectator));
        assert!(!hub.open(b, game(), Role::Player));
        assert_eq!(hub.watching(&game()), 1);

        assert!(!hub.close(a1, &game()));
        assert_eq!(hub.disconnect(a2), vec![game()]);
        assert_eq!(hub.watching(&game()), 0);
    }

    #[tokio::test(start_paused = true)]
    async fn players_get_every_state_and_their_own_part_spectators_the_latest() {
        let hub = Arc::new(Hub::default());
        let (player, mut player_messages) = connect(&hub, user(1));
        let (spectator, mut spectator_messages) = connect(&hub, user(2));
        hub.open(player, game(), Role::Player);
        hub.open(spectator, game(), Role::Spectator);

        for seq in 1..=4 {
            hub.push_state(game(), &state(seq));
        }
        assert_eq!(
            states(&mut player_messages),
            (1..=4).map(|seq| (seq, Some(json!({ "hand": [seq] })))).collect::<Vec<_>>()
        );
        // The first straight away, the rest held back
        assert_eq!(states(&mut spectator_messages), vec![(1, None)]);

        tokio::time::sleep(SPECTATOR_INTERVAL).await;
        tokio::task::yield_now().await;
        assert_eq!(states(&mut spectator_messages), vec![(4, None)]);
    }

    // A spectator who joins starts getting their own part, and someone removed from a game closed to
    // spectators stops getting anything
    #[test]
    fn a_users_open_connections_take_their_new_role() {
        let hub = Arc::new(Hub::default());
        let (tab1, mut tab1_messages) = connect(&hub, user(1));
        let (tab2, _) = connect(&hub, user(1));
        hub.open(tab1, game(), Role::Spectator);
        hub.open(tab2, game(), Role::Spectator);
        assert_eq!(hub.watching(&game()), 1);

        let (ids, watching_changed) = hub.set_role(
            game(),
            user(1),
            Some(Role::Player),
            ServerMessage::Role {
                game: game(),
                role: Role::Player,
                player_token: None,
            },
        );
        assert_eq!(ids.len(), 2);
        assert!(watching_changed);
        hub.push_state(game(), &state(1));
        assert_eq!(states(&mut tab1_messages), vec![(1, Some(json!({ "hand": [1] })))]);

        hub.set_role(game(), user(1), None, ServerMessage::Closed { game: game() });
        hub.push_state(game(), &state(2));
        assert!(states(&mut tab1_messages).is_empty());
        assert_eq!(hub.watching(&game()), 0);
    }

    #[test]
    fn a_card_goes_to_its_followers() {
        let hub = Hub::default();
        let (following, mut following_messages) = connect(&hub, user(1));
        let (other, mut other_messages) = connect(&hub, user(2));
        hub.follow(following, &[game()]);
        hub.follow(other, &[game()]);
        hub.unfollow(other, &[game()]);

        hub.push_card(card());
        assert!(matches!(following_messages.try_recv().as_deref(), Ok(ServerMessage::Card(_))));
        assert!(other_messages.try_recv().is_err());
    }

    // So it can't make the service queue messages without end
    #[test]
    fn a_connection_which_stops_reading_is_dropped() {
        let hub = Hub::default();
        let (sender, _receiver) = channel(2);
        let id = hub.connect(user(1), sender);
        hub.follow(id, &[game()]);

        for _ in 0..3 {
            hub.push_card(card());
        }
        assert!(hub.inner.lock().unwrap().connections.is_empty());
        assert!(hub.inner.lock().unwrap().followers.is_empty());
    }
}
