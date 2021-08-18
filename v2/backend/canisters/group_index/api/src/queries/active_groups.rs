use candid::CandidType;
use serde::Deserialize;
use types::{GroupChatId, Milliseconds};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub group_ids: Vec<GroupChatId>,
    pub active_in_last: Milliseconds,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub active_groups: Vec<GroupChatId>,
}
