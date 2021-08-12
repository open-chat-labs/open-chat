use candid::CandidType;
use serde::Deserialize;
use types::{MessageIndex, UserId};

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub user_id: UserId,
    pub up_to_message_index: MessageIndex,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success,
    SuccessNoChange,
    ChatNotFound,
    NotAuthorised,
}
