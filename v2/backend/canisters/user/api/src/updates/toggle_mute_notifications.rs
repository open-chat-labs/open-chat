use candid::CandidType;
use serde::Deserialize;
use types::ChatId;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub chat_id: ChatId,
    pub mute: bool,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    ChatNotFound,
}
