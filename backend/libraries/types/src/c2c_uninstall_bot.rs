use crate::UserId;
use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub caller: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NotAuthorized,
    Error(OCError),
}
