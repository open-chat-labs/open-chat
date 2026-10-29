// The messages of backend/docs/mini_app_service_protocol.md
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use types::{BlobReference, CanisterId, EventIndex, MiniAppContent, MiniAppGame, MiniAppImage, MiniAppStatus, UserId};

pub type RequestId = u64;

// What the website sends over the WebSocket
#[derive(Deserialize, Debug)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMessage {
    // With any of the user's chat tokens
    Connect {
        chat_token: String,
    },
    Follow {
        id: RequestId,
        chat_token: String,
        games: Vec<MiniAppGame>,
    },
    Unfollow {
        games: Vec<MiniAppGame>,
    },
    Join {
        id: RequestId,
        chat_token: String,
        game: MiniAppGame,
    },
    Open {
        id: RequestId,
        chat_token: String,
        game: MiniAppGame,
    },
    Close {
        game: MiniAppGame,
    },
    PlayerToken {
        id: RequestId,
        game: MiniAppGame,
    },
    Leave {
        id: RequestId,
        game: MiniAppGame,
    },
    // A player asks to start the game, which the bot does or refuses
    Start {
        id: RequestId,
        game: MiniAppGame,
    },
}

// What the service sends the website
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    Connected {
        user_id: UserId,
    },
    Error {
        code: ErrorCode,
    },
    Ok {
        id: RequestId,
    },
    Joined {
        id: RequestId,
        player_token: String,
    },
    Opened {
        id: RequestId,
        role: Role,
        #[serde(skip_serializing_if = "Option::is_none")]
        player_token: Option<String>,
    },
    PlayerToken {
        id: RequestId,
        token: String,
    },
    // A user's role in a game they have open changed, as they joined, left or were removed. A player
    // gets a player token. The latest state follows, with their own part if they're now a player.
    Role {
        game: MiniAppGame,
        role: Role,
        #[serde(skip_serializing_if = "Option::is_none")]
        player_token: Option<String>,
    },
    // A user stopped playing a game they had open, which spectators can't watch, so it's closed for them
    Closed {
        game: MiniAppGame,
    },
    Refused {
        id: RequestId,
        reason: Refusal,
        #[serde(skip_serializing_if = "Option::is_none")]
        message: Option<String>,
    },
    Card(Card),
    State {
        game: MiniAppGame,
        seq: u64,
        shared: Value,
        #[serde(skip_serializing_if = "Option::is_none")]
        private: Option<Value>,
    },
}

#[derive(Serialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCode {
    // The token to connect with is missing, invalid or expired, so the socket closes
    InvalidToken,
    // A message the service can't read
    InvalidMessage,
}

#[derive(Serialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    Player,
    Spectator,
}

#[derive(Serialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Refusal {
    // The chat token is invalid, expired, or someone else's
    InvalidToken,
    // A game isn't in the chat token's chat
    WrongChat,
    NotMember,
    UnknownGame,
    NotOpen,
    Full,
    RefusedByBot,
    BotUnavailable,
    NoSpectators,
    NotAPlayer,
    // The service couldn't read or save the game, so the website can try again
    Unavailable,
}

// Where a game's got to, in the order it goes, which it only moves forward through. The card in the chat
// records the players a game started with in its status; the live card shows who's playing now.
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum GameStatus {
    Open,
    Active,
    Finished,
}

// A game as its card shows it live
#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct Card {
    pub game: MiniAppGame,
    pub status: GameStatus,
    pub players: Vec<UserId>,
    // Whose turn it is
    pub waiting_for: Vec<UserId>,
    pub watching: u32,
    pub result: Option<String>,
}

// The body of the bots' `POST /bot/post`: the bot's post token from the LocalUserIndex, and the card.
// Kept with the game until OpenChat has taken the card, so a post cut off by a restart is sent again.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct PostArgs {
    pub token: String,
    pub card: CardContent,
    #[serde(default)]
    pub block_level_markdown: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub replies_to: Option<EventIndex>,
}

// A card as a bot posts it. Its status is Open, so isn't sent.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct CardContent {
    pub text: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub image: Option<CardImage>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_players: Option<u32>,
    #[serde(default)]
    pub spectators: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct CardImage {
    pub width: u32,
    pub height: u32,
    pub mime_type: String,
    pub blob_reference: CardBlob,
}

// The blob id is a decimal string, as it doesn't fit a JavaScript number
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct CardBlob {
    pub canister_id: CanisterId,
    pub blob_id: String,
}

impl CardContent {
    // The card as OpenChat takes it, checked as OpenChat checks a new card
    pub fn to_content(&self) -> Result<MiniAppContent, String> {
        let image = match &self.image {
            Some(image) => Some(MiniAppImage {
                width: image.width,
                height: image.height,
                mime_type: image.mime_type.clone(),
                blob_reference: BlobReference {
                    canister_id: image.blob_reference.canister_id,
                    blob_id: image
                        .blob_reference
                        .blob_id
                        .parse()
                        .map_err(|_| "The image's blob id must be a decimal string".to_string())?,
                },
            }),
            None => None,
        };
        let content = MiniAppContent {
            text: self.text.clone(),
            image,
            max_players: self.max_players,
            spectators: self.spectators,
            status: MiniAppStatus::Open,
        };
        content.validate_new()?;
        Ok(content)
    }
}

// The answer to `POST /bot/post`: the game, which is in the token too
#[derive(Serialize, Deserialize, Debug)]
pub struct PostResponse {
    pub game: MiniAppGame,
}

// The body of the bots' `POST /bot/update`. Every field but `game` is optional.
#[derive(Deserialize, Debug)]
pub struct UpdateArgs {
    pub game: MiniAppGame,
    #[serde(default)]
    pub status: Option<GameStatus>,
    // Whose turn it is now, or none to leave it as it is
    #[serde(default)]
    pub waiting_for: Option<Vec<UserId>>,
    #[serde(default)]
    pub result: Option<String>,
    #[serde(default)]
    pub remove: Vec<UserId>,
    #[serde(default)]
    pub state: Option<GameState>,
}

// A game's state as its bot publishes it: what everyone sees, and each player's own part
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct GameState {
    pub seq: u64,
    pub shared: Value,
    #[serde(default)]
    pub private: HashMap<UserId, Value>,
}

// A bot's answer to `POST <endpoint>/mini_app/start`: if it starts the game, who plays, whose turn it
// is first, and the game's first state
#[derive(Serialize, Deserialize, Debug)]
pub struct StartResponse {
    pub accepted: bool,
    #[serde(default)]
    pub message: Option<String>,
    #[serde(default)]
    pub players: Vec<UserId>,
    #[serde(default)]
    pub waiting_for: Vec<UserId>,
    #[serde(default)]
    pub state: Option<GameState>,
}

// A bot's answer to `POST <endpoint>/mini_app/join`
#[derive(Serialize, Deserialize, Debug)]
pub struct JoinResponse {
    pub accepted: bool,
    #[serde(default)]
    pub message: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use serde_json::json;
    use types::Chat;

    fn game() -> MiniAppGame {
        MiniAppGame {
            chat: Chat::Group(Principal::from_text("6nb6r-kyaaa-aaaar-asvgq-cai").unwrap().into()),
            thread: None,
            message_id: u64::MAX.into(),
        }
    }

    #[test]
    fn messages_read_and_write_as_the_protocol_says() {
        let join: ClientMessage = serde_json::from_value(json!({
            "type": "join",
            "id": 2,
            "chat_token": "token",
            "game": { "chat": { "Group": "6nb6r-kyaaa-aaaar-asvgq-cai" }, "thread": null, "message_id": "18446744073709551615" }
        }))
        .unwrap();
        assert!(matches!(join, ClientMessage::Join { id: 2, game: g, .. } if g == game()));

        let user: UserId = Principal::from_text("27eue-hyaaa-aaaaf-aaa4a-cai").unwrap().into();
        let card = ServerMessage::Card(Card {
            game: game(),
            status: GameStatus::Active,
            players: vec![user],
            waiting_for: vec![user],
            watching: 3,
            result: None,
        });
        assert_eq!(
            serde_json::to_value(card).unwrap(),
            json!({
                "type": "card",
                "game": { "chat": { "Group": "6nb6r-kyaaa-aaaar-asvgq-cai" }, "thread": null, "message_id": "18446744073709551615" },
                "status": "Active",
                "players": ["27eue-hyaaa-aaaaf-aaa4a-cai"],
                "waiting_for": ["27eue-hyaaa-aaaaf-aaa4a-cai"],
                "watching": 3,
                "result": null
            })
        );

        let refused = ServerMessage::Refused {
            id: 4,
            reason: Refusal::NotAPlayer,
            message: None,
        };
        assert_eq!(
            serde_json::to_value(refused).unwrap(),
            json!({ "type": "refused", "id": 4, "reason": "not_a_player" })
        );
    }

    // Private parts are keyed by user id
    #[test]
    fn a_bots_update_reads_with_its_players_private_parts() {
        let update: UpdateArgs = serde_json::from_value(json!({
            "game": { "chat": { "Group": "6nb6r-kyaaa-aaaar-asvgq-cai" }, "thread": null, "message_id": "18446744073709551615" },
            "status": "Active",
            "state": { "seq": 1, "shared": { "turn": 0 }, "private": { "27eue-hyaaa-aaaaf-aaa4a-cai": { "hand": [1, 2] } } }
        }))
        .unwrap();
        let state = update.state.unwrap();
        let user: UserId = Principal::from_text("27eue-hyaaa-aaaaf-aaa4a-cai").unwrap().into();
        assert_eq!(state.private.get(&user), Some(&json!({ "hand": [1, 2] })));
        assert_eq!(update.status, Some(GameStatus::Active));
        assert!(update.remove.is_empty());
    }
}
