use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::Chat;

#[ts_export(user, manage_favourite_chats)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub to_add: Vec<Chat>,
    pub to_remove: Vec<Chat>,
}

#[ts_export(user, manage_favourite_chats)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    UserSuspended,
    Error(OCError),
}
