use crate::{BotPermissions, CanisterId, ChannelId, Chat, CommunityId, MessageId, MessageIndex, UserId, VideoCallType};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub enum AccessTokenType {
    StartVideoCallV2(VideoCallAccessTokenArgs),
    JoinVideoCall,
    MarkVideoCallAsEnded,
}

#[ts_export]
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

    pub fn chat(&self, channel_id: Option<ChannelId>) -> Option<Chat> {
        match self {
            BotActionScope::Chat(details) => Some(details.chat),
            BotActionScope::Community(details) => channel_id.map(|channel_id| Chat::Channel(details.community_id, channel_id)),
        }
    }

    pub fn channel_id(&self) -> Option<ChannelId> {
        match self {
            Self::Chat(details) => match details.chat {
                Chat::Channel(_, channel_id) => Some(channel_id),
                _ => None,
            },
            _ => None,
        }
    }

    pub fn thread(&self) -> Option<MessageIndex> {
        match self {
            Self::Chat(details) => details.thread,
            _ => None,
        }
    }
}

impl From<BotActionScope> for AutonomousBotScope {
    fn from(value: BotActionScope) -> Self {
        match value {
            BotActionScope::Chat(details) => AutonomousBotScope::Chat(details.chat),
            BotActionScope::Community(details) => AutonomousBotScope::Community(details.community_id),
        }
    }
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct BotActionChatDetails {
    pub chat: Chat,
    pub thread: Option<MessageIndex>,
    pub message_id: MessageId,
    pub user_message_id: Option<MessageId>,
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
pub enum AutonomousBotScope {
    Chat(Chat),
    Community(CommunityId),
}

impl AutonomousBotScope {
    pub fn canister_id(&self) -> CanisterId {
        match self {
            AutonomousBotScope::Chat(chat) => chat.canister_id(),
            AutonomousBotScope::Community(community_id) => (*community_id).into(),
        }
    }

    pub fn chat(&self, channel_id: Option<ChannelId>) -> Option<Chat> {
        match self {
            AutonomousBotScope::Chat(chat) => Some(*chat),
            AutonomousBotScope::Community(community_id) => {
                channel_id.map(|channel_id| Chat::Channel(*community_id, channel_id))
            }
        }
    }
}
