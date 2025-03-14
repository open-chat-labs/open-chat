use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{
    EventIndex, GroupReplyContext, InvalidPollReason, MessageContentInitial, MessageId, MessageIndex, TimestampMillis, User,
    Version,
};

#[ts_export(group, send_message)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub content: MessageContentInitial,
    pub sender_name: String,
    pub sender_display_name: Option<String>,
    pub replies_to: Option<GroupReplyContext>,
    pub mentioned: Vec<User>,
    pub forwarding: bool,
    pub block_level_markdown: bool,
    pub rules_accepted: Option<Version>,
    pub message_filter_failed: Option<u64>,
    pub new_achievement: bool,
    pub correlation_id: u64,
}

#[ts_export(group, send_message)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    ThreadMessageNotFound,
    MessageEmpty,
    TextTooLong(u32),
    InvalidPoll(InvalidPollReason),
    NotAuthorized,
    CallerNotInGroup,
    UserSuspended,
    UserLapsed,
    InvalidRequest(String),
    ChatFrozen,
    RulesNotAccepted,
    MessageAlreadyExists,
    Error(u16, Option<String>),
}

#[ts_export(group, send_message)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub event_index: EventIndex,
    pub message_index: MessageIndex,
    pub timestamp: TimestampMillis,
    pub expires_at: Option<TimestampMillis>,
}
