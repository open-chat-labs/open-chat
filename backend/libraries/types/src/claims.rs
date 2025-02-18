use crate::{AccessTokenScope, BotActionScope, BotCommand, BotPermissions, CanisterId, Chat, UserId, VideoCallType};
use serde::{Deserialize, Serialize};

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
pub struct BotActionByCommandClaims {
    pub bot_api_gateway: CanisterId,
    pub bot: UserId,
    pub scope: BotActionScope,
    pub granted_permissions: BotPermissions,
    pub command: BotCommand,
}

#[derive(Serialize, Deserialize)]
pub struct BotActionByApiKeyClaims {
    pub bot_api_gateway: CanisterId,
    pub bot: UserId,
    pub scope: AccessTokenScope,
    pub granted_permissions: BotPermissions,
}

#[derive(Serialize, Deserialize)]
pub struct BotReadApiKeyClaims {
    pub bot_api_gateway: CanisterId,
    pub bot: UserId,
    pub scope: AccessTokenScope,
}
