use candid::CandidType;
use serde::Deserialize;
use shared::types::MessageIndex;

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub up_to_message_index: MessageIndex,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success,
    SuccessNoChange,
    NotInChat,
}
