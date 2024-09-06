use candid::CandidType;
use ts_export::ts_export;
use types::ChatId;

#[ts_export(user, mute_notifications)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub chat_id: ChatId,
}

#[ts_export(user, mute_notifications)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
    ChatNotFound,
    InternalError(String),
}
