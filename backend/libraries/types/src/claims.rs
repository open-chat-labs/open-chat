use crate::{BotActionScope, BotCommand, BotPermissions, CanisterId, Chat, UserId, VideoCallType};
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

#[derive(Serialize, Deserialize)]
pub struct BotActionByCommandClaims {
    pub bot_api_gateway: CanisterId,
    pub bot: UserId,
    pub scope: BotActionScope,
    pub granted_permissions: BotPermissions,
    pub command: BotCommand,
}
