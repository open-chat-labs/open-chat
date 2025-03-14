use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::Chat;

#[ts_export(user, archive_unarchive_chats)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub to_archive: Vec<Chat>,
    pub to_unarchive: Vec<Chat>,
}

#[ts_export(user, archive_unarchive_chats)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    PartialSuccess(PartialSuccessResult),
    Failure,
    UserSuspended,
    Error(OCError),
}

#[ts_export(user, archive_unarchive_chats)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct PartialSuccessResult {
    pub chats_not_found: Vec<Chat>,
}
