use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Empty, EventIndex, GroupMember, MessageIndex, Rules, TimestampMillis, UserId, VersionedRules};

pub type Args = Empty;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    CallerNotInGroup,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub timestamp: TimestampMillis,
    pub latest_event_index: EventIndex,
    pub participants: Vec<GroupMember>,
    pub blocked_users: Vec<UserId>,
    pub invited_users: Vec<UserId>,
    pub pinned_messages: Vec<MessageIndex>,
    // TODO: remove this field once the website is using `chat_rules` instead
    pub rules: Rules,
    pub chat_rules: VersionedRules,
}
