use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::Chat;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub to_add: Vec<Chat>,
    pub to_remove: Vec<Chat>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    UserSuspended,
}
