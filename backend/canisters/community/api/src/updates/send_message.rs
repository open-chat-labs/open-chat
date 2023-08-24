use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{
    ChannelId, EventIndex, GroupReplyContext, InvalidPollReason, MessageContentInitial, MessageId, MessageIndex,
    TimestampMillis, User, Version,
};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub content: MessageContentInitial,
    pub sender_name: String,
    pub replies_to: Option<GroupReplyContext>,
    pub mentioned: Vec<User>,
    pub forwarding: bool,
    #[serde(default)]
    pub community_rules_accepted: Option<Version>,
    #[serde(default)]
    pub channel_rules_accepted: Option<Version>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    ChannelNotFound,
    ThreadMessageNotFound,
    MessageEmpty,
    TextTooLong(u32),
    InvalidPoll(InvalidPollReason),
    NotAuthorized,
    UserNotInCommunity,
    UserNotInChannel,
    UserSuspended,
    InvalidRequest(String),
    CommunityFrozen,
    RulesNotAccepted,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub event_index: EventIndex,
    pub message_index: MessageIndex,
    pub timestamp: TimestampMillis,
    pub expires_at: Option<TimestampMillis>,
}
