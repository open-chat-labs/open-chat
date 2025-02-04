use crate::{BotPermissions, CanisterId, Chat, CommunityId, MessageId, MessageIndex, UserId, VideoCallType};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export]
#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub enum AccessTokenType {
    StartVideoCallV2(VideoCallAccessTokenArgs),
    JoinVideoCall,
    MarkVideoCallAsEnded,
}

#[ts_export]
#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub enum CheckAccessTokenType {
    StartVideoCallV2(VideoCallAccessTokenArgs),
    JoinVideoCall,
    MarkVideoCallAsEnded,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct VideoCallAccessTokenArgs {
    pub call_type: VideoCallType,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub enum BotActionScope {
    Chat(BotActionChatDetails),
    Community(BotActionCommunityDetails),
}

impl BotActionScope {
    pub fn canister_id(&self) -> CanisterId {
        match self {
            BotActionScope::Chat(scope) => scope.chat.canister_id(),
            BotActionScope::Community(scope) => scope.community_id.into(),
        }
    }
}

impl From<BotActionScope> for AccessTokenScope {
    fn from(value: BotActionScope) -> Self {
        match value {
            BotActionScope::Chat(details) => AccessTokenScope::Chat(details.chat),
            BotActionScope::Community(details) => AccessTokenScope::Community(details.community_id),
        }
    }
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct BotActionChatDetails {
    pub chat: Chat,
    pub thread: Option<MessageIndex>,
    pub message_id: MessageId,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct BotActionCommunityDetails {
    pub community_id: CommunityId,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct BotActionCheckAccessToken {
    pub bot: UserId,
    pub initiator: BotActionInitiator,
    pub scope: BotActionScope,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub enum BotActionInitiator {
    Command(BotActionCheckCommand),
    ApiKey(BotActionCheckApiKey),
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct BotActionCheckCommand {
    pub user_id: UserId,
    pub permissions: BotPermissions,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct BotActionCheckApiKey {
    pub secret: String,
}

impl AccessTokenType {
    pub fn type_name(&self) -> &str {
        match self {
            AccessTokenType::StartVideoCallV2(_) => "StartVideoCall",
            AccessTokenType::JoinVideoCall => "JoinVideoCall",
            AccessTokenType::MarkVideoCallAsEnded => "MarkVideoCallAsEnded",
        }
    }
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub enum AccessTokenScope {
    Chat(Chat),
    Community(CommunityId),
}

impl AccessTokenScope {
    pub fn canister_id(&self) -> CanisterId {
        match self {
            AccessTokenScope::Chat(chat) => chat.canister_id(),
            AccessTokenScope::Community(community_id) => (*community_id).into(),
        }
    }
}
