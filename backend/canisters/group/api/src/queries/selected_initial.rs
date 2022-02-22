use candid::CandidType;
use serde::Deserialize;
use types::{EventIndex, MessageIndex, Participant, UserId};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    CallerNotInGroup,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub latest_event_index: EventIndex,
    pub participants: Vec<Participant>,
    pub blocked_users: Vec<UserId>,
    pub pinned_messages: Vec<MessageIndex>,
}
