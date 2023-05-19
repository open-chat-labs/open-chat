use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{
    CommunityGroupId, EventIndex, GroupReplyContext, InvalidPollReason, MessageContentInitial, MessageId, MessageIndex,
    TimestampMillis, User,
};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub group_id: CommunityGroupId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub content: MessageContentInitial,
    pub sender_name: String,
    pub replies_to: Option<GroupReplyContext>,
    pub mentioned: Vec<User>,
    pub forwarding: bool,
    pub correlation_id: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    GroupNotFound,
    ThreadMessageNotFound,
    MessageEmpty,
    TextTooLong(u32),
    InvalidPoll(InvalidPollReason),
    NotAuthorized,
    CallerNotInCommunity,
    UserSuspended,
    InvalidRequest(String),
    ChatFrozen,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub event_index: EventIndex,
    pub message_index: MessageIndex,
    pub timestamp: TimestampMillis,
    pub expires_at: Option<TimestampMillis>,
}
