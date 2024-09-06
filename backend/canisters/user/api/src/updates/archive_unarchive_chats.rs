use candid::CandidType;
use ts_export::ts_export;
use types::Chat;

#[ts_export(user, archive_unarchive_chats)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub to_archive: Vec<Chat>,
    pub to_unarchive: Vec<Chat>,
}

#[ts_export(user, archive_unarchive_chats)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
    PartialSuccess(PartialSuccessResult),
    Failure,
    UserSuspended,
}

#[ts_export(user, archive_unarchive_chats)]
#[derive(CandidType, Debug)]
pub struct PartialSuccessResult {
    pub chats_not_found: Vec<Chat>,
}
