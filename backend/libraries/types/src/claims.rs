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
pub const CLAIM_TYPE_BOT_ACTION_BY_COMMAND: &str = "BotActionByCommand";
pub const CLAIM_TYPE_NCA_VAULT_EXPORT: &str = "NcaVaultExport";
pub const CLAIM_TYPE_NCA_SUBMITTER: &str = "NcaSubmitter";

#[derive(Serialize, Deserialize)]
pub struct JoinOrEndVideoCallClaims {
    pub user_id: UserId,
    pub chat_id: Chat,
}

#[derive(Serialize, Deserialize)]
pub struct StartVideoCallClaims {
    pub user_id: UserId,
    pub chat_id: Chat,
    pub call_type: VideoCallType,
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
