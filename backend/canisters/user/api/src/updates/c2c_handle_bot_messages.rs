use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{BotMessage, ContentValidationError};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_name: String,
    pub messages: Vec<BotMessage>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Blocked,
    ContentValidationError(ContentValidationError),
}
