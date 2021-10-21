use candid::CandidType;
use serde::Deserialize;
use types::{Participant, TimestampMillis, UserId};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub updates_since: Option<TimestampMillis>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    SuccessNoUpdates,
    CallerNotInGroup,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub timestamp: TimestampMillis,
    pub participants_added_or_updated: Vec<Participant>,
    pub participants_removed: Vec<UserId>,
    pub blocked_users_added: Vec<UserId>,
    pub blocked_users_removed: Vec<UserId>,
}
