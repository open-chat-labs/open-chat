use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChatId, Milliseconds};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat_ids: Vec<ChatId>,
    pub active_in_last: Option<Milliseconds>,
}

pub type Response = crate::filter_groups::Response;
