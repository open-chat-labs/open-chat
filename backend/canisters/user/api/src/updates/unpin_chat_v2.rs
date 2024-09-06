use crate::ChatInList;
use candid::CandidType;
use ts_export::ts_export;

#[ts_export(user, unpin_chat)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub chat: ChatInList,
}

#[ts_export(user, unpin_chat)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
    ChatNotFound,
}
