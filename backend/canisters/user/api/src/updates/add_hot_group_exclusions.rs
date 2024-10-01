use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChatId, Milliseconds};

#[ts_export(user, add_hot_group_exclusions)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub groups: Vec<ChatId>,
    pub duration: Option<Milliseconds>,
}

#[ts_export(user, add_hot_group_exclusions)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
