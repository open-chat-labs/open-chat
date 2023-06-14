use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::Chat;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub to_archive: Vec<Chat>,
    pub to_unarchive: Vec<Chat>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    PartialSuccess(PartialSuccessResult),
    Failure,
    UserSuspended,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct PartialSuccessResult {
    pub chats_not_found: Vec<Chat>,
}
