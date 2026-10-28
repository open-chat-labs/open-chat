// The website's connections: which cards each follows, which games each has open, and pushing them what
// changes. It's in memory, so a deploy drops every connection, which the website reopens.
use crate::protocol::{Card, GameState, Role, ServerMessage};
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::mpsc::UnboundedSender;
use tokio::time::Instant;
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
    sender: UnboundedSender<ServerMessage>,
    following: HashSet<MiniAppGame>,
    open: HashSet<MiniAppGame>,
}

struct SpectatorFeed {
    last_sent: Instant,
    // The latest state, held back until the spectators can have it
    pending: Option<GameState>,
}

impl Hub {
    pub fn connect(&self, user_id: UserId, sender: UnboundedSender<ServerMessage>) -> ConnectionId {
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
        let mut inner = self.inner.lock().unwrap();
        let Some(connection) = inner.connections.remove(&id) else {
            return Vec::new();
        };
        for game in &connection.following {
            if let Some(followers) = inner.followers.get_mut(game) {
                followers.remove(&id);
                if followers.is_empty() {
                    inner.followers.remove(game);
                }
            }
        }
        connection
            .open
            .iter()
            .filter(|game| inner.close(id, game) == Some(Role::Spectator))
            .copied()
            .collect()
    }

    pub fn send(&self, id: ConnectionId, message: ServerMessage) {
        if let Some(connection) = self.inner.lock().unwrap().connections.get(&id) {
            let _ = connection.sender.send(message);
        }
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
            if let Some(followers) = inner.followers.get_mut(game) {
                followers.remove(&id);
                if followers.is_empty() {
                    inner.followers.remove(game);
                }
            }
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
        if let Some(connection) = inner.connections.get_mut(&id) {
            connection.open.remove(game);
        }
        let before = inner.watching(game);
        inner.close(id, game);
        inner.watching(game) != before
    }

    // How many people are watching, counted once however many times they have it open
    pub fn watching(&self, game: &MiniAppGame) -> u32 {
        self.inner.lock().unwrap().watching(game)
    }

    pub fn push_card(&self, card: Card) {
        let inner = self.inner.lock().unwrap();
        for id in inner.followers.get(&card.game).into_iter().flatten() {
            if let Some(connection) = inner.connections.get(id) {
                let _ = connection.sender.send(ServerMessage::Card(card.clone()));
            }
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

    // A player opening a game which already has a state, or a spectator
    pub fn send_latest_state(&self, id: ConnectionId, game: MiniAppGame, state: &GameState, role: Role) {
        let inner = self.inner.lock().unwrap();
        if let Some(connection) = inner.connections.get(&id) {
            let _ = connection.sender.send(state_message(game, state, connection.user_id, role));
        }
    }
}

impl HubInner {
    fn close(&mut self, id: ConnectionId, game: &MiniAppGame) -> Option<Role> {
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

    fn send_state(&self, game: &MiniAppGame, state: &GameState, to: Role) {
        for (id, role) in self.openers.get(game).into_iter().flatten() {
            if *role == to
                && let Some(connection) = self.connections.get(id)
            {
                let _ = connection.sender.send(state_message(*game, state, connection.user_id, to));
            }
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
    use tokio::sync::mpsc::{UnboundedReceiver, unbounded_channel};
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

    fn connect(hub: &Hub, user_id: UserId) -> (ConnectionId, UnboundedReceiver<ServerMessage>) {
        let (sender, receiver) = unbounded_channel();
        (hub.connect(user_id, sender), receiver)
    }

    fn state(seq: u64) -> GameState {
        GameState {
            seq,
            shared: json!({ "seq": seq }),
            private: HashMap::from([(user(1), json!({ "hand": [seq] }))]),
        }
    }

    fn states(receiver: &mut UnboundedReceiver<ServerMessage>) -> Vec<(u64, Option<serde_json::Value>)> {
        let mut states = Vec::new();
        while let Ok(message) = receiver.try_recv() {
            if let ServerMessage::State { seq, private, .. } = message {
                states.push((seq, private));
            }
        }
        states
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

    #[test]
    fn a_card_goes_to_its_followers() {
        let hub = Hub::default();
        let (following, mut following_messages) = connect(&hub, user(1));
        let (other, mut other_messages) = connect(&hub, user(2));
        hub.follow(following, &[game()]);
        hub.follow(other, &[game()]);
        hub.unfollow(other, &[game()]);

        hub.push_card(Card {
            game: game(),
            status: crate::protocol::GameStatus::Open,
            players: Vec::new(),
            watching: 0,
            result: None,
        });
        assert!(matches!(following_messages.try_recv(), Ok(ServerMessage::Card(_))));
        assert!(other_messages.try_recv().is_err());
    }
}
