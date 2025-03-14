use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::ChatId;

#[ts_export(user, mute_notifications)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat_id: ChatId,
}

#[ts_export(user, mute_notifications)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    ChatNotFound,
    InternalError(String),
    Error(u16, Option<String>),
}
