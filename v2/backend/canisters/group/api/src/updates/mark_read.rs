use candid::CandidType;
use serde::Deserialize;
use shared::types::MessageIndex;

#[derive(Deserialize)]
pub struct Args {
    pub up_to_message_index: MessageIndex,
}

#[derive(CandidType)]
pub enum Response {
    Success,
    SuccessNoChange,
    NotInChat,
}
