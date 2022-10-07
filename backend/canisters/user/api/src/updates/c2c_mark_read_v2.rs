use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::MessageIndex;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub read_up_to: MessageIndex,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    SuccessNoChange,
    ChatNotFound,
}
