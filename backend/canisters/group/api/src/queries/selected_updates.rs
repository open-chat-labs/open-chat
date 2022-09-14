use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{EventIndex, GroupRules, MessageIndex, Participant, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub updates_since: EventIndex,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    SuccessNoUpdates(EventIndex),
    CallerNotInGroup,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub latest_event_index: EventIndex,
    pub participants_added_or_updated: Vec<Participant>,
    pub participants_removed: Vec<UserId>,
    pub blocked_users_added: Vec<UserId>,
    pub blocked_users_removed: Vec<UserId>,
    pub pinned_messages_added: Vec<MessageIndex>,
    pub pinned_messages_removed: Vec<MessageIndex>,
    pub rules: Option<GroupRules>,
}
