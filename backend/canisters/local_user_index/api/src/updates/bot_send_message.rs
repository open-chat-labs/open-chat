use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{AuthToken, BotMessageContent, ChannelId, EventIndex, MessageId, MessageIndex, TimestampMillis};

#[ts_export(local_user_index, bot_send_message)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub channel_id: Option<ChannelId>,
    pub message_id: Option<MessageId>,
    pub content: BotMessageContent,
    pub block_level_markdown: bool,
    pub finalised: bool,
    pub auth_token: AuthToken,
}

#[ts_export(local_user_index, bot_send_message)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    FailedAuthentication(String),
    InvalidRequest(String),
    NotAuthorized,
    Frozen,
    ThreadNotFound,
    MessageAlreadyFinalised,
    C2CError(i32, String),
}

#[ts_export(local_user_index, bot_send_message)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct SuccessResult {
    pub message_id: MessageId,
    pub event_index: EventIndex,
    pub message_index: MessageIndex,
    pub timestamp: TimestampMillis,
    pub expires_at: Option<TimestampMillis>,
}
