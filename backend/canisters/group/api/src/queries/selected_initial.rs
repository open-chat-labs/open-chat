use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Empty, EventIndex, GroupRules, MessageIndex, Participant, UserId};

pub type Args = Empty;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    CallerNotInGroup,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub latest_event_index: EventIndex,
    pub participants: Vec<Participant>,
    pub blocked_users: Vec<UserId>,
    pub pinned_messages: Vec<MessageIndex>,
    pub rules: GroupRules,
}
