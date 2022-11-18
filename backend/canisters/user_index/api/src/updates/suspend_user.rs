use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Milliseconds, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub duration: Option<Milliseconds>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    InternalError(String),
}
