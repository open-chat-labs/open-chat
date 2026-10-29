use crate::{
    BlobReference, BotActionScope, BotCommand, BotPermissions, CanisterId, Chat, MessageId, MessageIndex, NcaPriority, UserId,
    VideoCallType,
};
use serde::{Deserialize, Serialize};

// The `claim_type` values written into the JWTs we sign. Each token must be verified against the
// claim type it was issued for, otherwise a token minted for one purpose could be replayed as a
// token for another (all of our JWTs are signed by the same key pair, and unrecognised claims are
// ignored when deserializing, so a token whose claims happen to be a superset of the expected ones
// would otherwise be accepted).
pub const CLAIM_TYPE_USER_SIGNED_IN: &str = "user_signed_in";
pub const CLAIM_TYPE_DIAMOND_MEMBERSHIP: &str = "diamond_membership";
pub const CLAIM_TYPE_START_VIDEO_CALL: &str = "StartVideoCall";
pub const CLAIM_TYPE_JOIN_VIDEO_CALL: &str = "JoinVideoCall";
pub const CLAIM_TYPE_MARK_VIDEO_CALL_AS_ENDED: &str = "MarkVideoCallAsEnded";
pub const CLAIM_TYPE_DECLINE_VIDEO_CALL: &str = "DeclineVideoCall";
// Proof that a user belongs to a chat with a call in it, and nothing more: the bridge accepts
// it for a decline or a leave, never for a join. See open-chat #9559.
pub const CLAIM_TYPE_VIDEO_CALL_PARTICIPANT: &str = "VideoCallParticipant";
pub const CLAIM_TYPE_BOT_ACTION_BY_COMMAND: &str = "BotActionByCommand";
// The MiniApp service's tokens. The LocalUserIndexes sign the first three with OpenChat's key, and the
// service signs the rest with its own, which bots fetch from the service.
//
// That a user can see a chat, and whether they're a member of it. The service takes it to open a
// WebSocket, as its user, to follow the chat's game cards and to watch its games, and, from a member,
// to join one.
pub const CLAIM_TYPE_MINI_APP_CHAT: &str = "MiniAppChat";
// A game a bot has just posted, which the bot passes to the service to register it
pub const CLAIM_TYPE_MINI_APP_REGISTRATION: &str = "MiniAppRegistration";
// Which bot is calling the service
pub const CLAIM_TYPE_MINI_APP_BOT: &str = "MiniAppBot";
// Signed by the service: a user is a player in a game. The bot's server takes it with the player's
// requests.
pub const CLAIM_TYPE_MINI_APP_PLAYER: &str = "MiniAppPlayer";
// Signed by the service: a user asks to join a game, which the bot accepts or refuses
pub const CLAIM_TYPE_MINI_APP_JOIN: &str = "MiniAppJoin";
// Signed by the service: a player has left a game
pub const CLAIM_TYPE_MINI_APP_LEAVE: &str = "MiniAppLeave";
// Signed by the service: a player asks to start a game, which the bot does, with its players, or refuses
pub const CLAIM_TYPE_MINI_APP_START: &str = "MiniAppStart";
pub const CLAIM_TYPE_NCA_VAULT_EXPORT: &str = "NcaVaultExport";
pub const CLAIM_TYPE_NCA_SUBMITTER: &str = "NcaSubmitter";

#[derive(Serialize, Deserialize)]
pub struct JoinOrEndVideoCallClaims {
    pub user_id: UserId,
    pub chat_id: Chat,
    // The local user index that signed the token, so the video bridge can route a decline
    // back to it. Absent from tokens signed before declines existed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub local_user_index: Option<CanisterId>,
}

// Carried in a ring push, one per recipient, so a phone whose app is not running can decline
// the call without an identity. It names one user, one call and the local user index that
// signed it, and expires with the ring window. See open-chat #9534.
#[derive(Serialize, Deserialize)]
pub struct DeclineVideoCallClaims {
    pub user_id: UserId,
    pub chat_id: Chat,
    // As a string: the bridge reads it in JavaScript, where a number this size loses digits
    pub message_id: String,
    pub local_user_index: CanisterId,
}

#[derive(Serialize, Deserialize)]
pub struct StartVideoCallClaims {
    pub user_id: UserId,
    pub chat_id: Chat,
    pub call_type: VideoCallType,
    #[serde(default)]
    pub audio_only: bool,
    pub is_diamond: bool,
}

#[derive(Serialize, Deserialize)]
pub struct TranslateClaims {
    pub user_id: UserId,
}

// Authorizes the NCA filing service to export one report's vaulted evidence, within a
// human-opened, report-scoped window. Forwarded to canisters, so it must never carry the
// moderator's contact details (a JWT is signed, not encrypted) - those travel only in the
// companion NcaSubmitterClaims token, which the service alone consumes. The shared nonce ties
// the pair together.
#[derive(Serialize, Deserialize, Clone)]
pub struct NcaVaultExportClaims {
    pub report_index: u64,
    // The moderator who opened the filing window; exports are attributed to them
    pub user_id: UserId,
    pub priority: NcaPriority,
    pub sender: UserId,
    pub chat: Chat,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    // The evidence the moderator authorised for export - the buckets refuse any other file
    pub files: Vec<NcaFileClaim>,
    pub ooh_call_acknowledged: bool,
    // String-encoded: the claims are embedded via #[serde(flatten)], whose internal buffering
    // cannot represent a u128, so a numeric nonce would fail to deserialize
    #[serde(with = "u128_as_string")]
    pub nonce: u128,
}

// The reporter's contact details for the NCA submission. Service-only: never sent to a
// canister, so the details never enter ingress bodies or trace buffers.
#[derive(Serialize, Deserialize, Clone)]
pub struct NcaSubmitterClaims {
    pub report_index: u64,
    // Ties this token to its NcaVaultExportClaims twin (string-encoded, see above)
    #[serde(with = "u128_as_string")]
    pub nonce: u128,
    pub first_name: String,
    pub last_name: String,
    pub phone: String,
    pub country_calling_code: String,
    pub email: String,
}

// A BlobReference for embedding in JWT claims: the claims are JSON under #[serde(flatten)],
// whose internal buffering cannot represent a u128, so the blob id is string-encoded
#[derive(Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct NcaFileClaim {
    pub canister_id: CanisterId,
    #[serde(with = "u128_as_string")]
    pub blob_id: u128,
}

impl From<&BlobReference> for NcaFileClaim {
    fn from(value: &BlobReference) -> NcaFileClaim {
        NcaFileClaim {
            canister_id: value.canister_id,
            blob_id: value.blob_id,
        }
    }
}

impl From<&NcaFileClaim> for BlobReference {
    fn from(value: &NcaFileClaim) -> BlobReference {
        BlobReference {
            canister_id: value.canister_id,
            blob_id: value.blob_id,
        }
    }
}

mod u128_as_string {
    use serde::{Deserialize, Deserializer, Serializer};

    pub fn serialize<S: Serializer>(value: &u128, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.collect_str(value)
    }

    pub fn deserialize<'de, D: Deserializer<'de>>(deserializer: D) -> Result<u128, D::Error> {
        let s = String::deserialize(deserializer)?;
        s.parse().map_err(serde::de::Error::custom)
    }
}

#[derive(Serialize, Deserialize)]
pub struct BotActionByCommandClaims {
    pub bot_api_gateway: CanisterId,
    pub bot: UserId,
    pub scope: BotActionScope,
    pub granted_permissions: BotPermissions,
    pub command: BotCommand,
}

// A game, which is played from one of a bot's MiniApp messages
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct MiniAppGame {
    pub chat: Chat,
    pub thread: Option<MessageIndex>,
    pub message_id: MessageId,
}

#[derive(Serialize, Deserialize)]
pub struct MiniAppChatClaims {
    pub user_id: UserId,
    pub chat: Chat,
    // A member may join the chat's games. Someone who can only see the chat, a public group, may
    // watch them.
    pub member: bool,
}

// What the service needs to know of a game, from when the bot posted it
#[derive(Serialize, Deserialize)]
pub struct MiniAppRegistrationClaims {
    pub bot: UserId,
    // Where the service sends join requests, as the bot was registered when it posted the game
    pub bot_endpoint: String,
    // The LocalUserIndex the service writes the game's card through
    pub bot_api_gateway: CanisterId,
    pub game: MiniAppGame,
    pub max_players: Option<u32>,
    pub spectators: bool,
}

#[derive(Serialize, Deserialize)]
pub struct MiniAppBotClaims {
    pub bot: UserId,
}

// A player token, and the service's calls telling a bot that a user asks to join, has left, or asks to
// start the game
#[derive(Serialize, Deserialize)]
pub struct MiniAppPlayerClaims {
    pub bot: UserId,
    pub game: MiniAppGame,
    pub user_id: UserId,
}
