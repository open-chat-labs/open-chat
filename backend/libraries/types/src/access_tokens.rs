use crate::{BotCommand, Chat, MessageId, MessageIndex, SlashCommandPermissions, UserId, VideoCallType};
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
    BotAction(AccessTokenBotAction),
}

#[ts_export]
#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub enum CheckAccessTokenType {
    StartVideoCallV2(VideoCallAccessTokenArgs),
    JoinVideoCall,
    MarkVideoCallAsEnded,
    BotAction(CheckAccessTokenBotAction),
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct VideoCallAccessTokenArgs {
    pub call_type: VideoCallType,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct AccessTokenBotAction {
    pub user_id: UserId,
    pub bot: UserId,
    pub chat: Chat,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub command: BotCommand,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct CheckAccessTokenBotAction {
    pub user_id: UserId,
    pub bot: UserId,
    pub chat: Chat,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub permissions: SlashCommandPermissions,
}

impl AccessTokenType {
    pub fn type_name(&self) -> &str {
        match self {
            AccessTokenType::StartVideoCallV2(_) => "StartVideoCall",
            AccessTokenType::JoinVideoCall => "JoinVideoCall",
            AccessTokenType::MarkVideoCallAsEnded => "MarkVideoCallAsEnded",
            AccessTokenType::BotAction(_) => "BotAction",
        }
    }
}
