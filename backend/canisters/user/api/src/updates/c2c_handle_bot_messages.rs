use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::{BotMessage, ContentValidationError};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_name: String,
    pub bot_display_name: Option<String>,
    pub messages: Vec<BotMessage>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    ContentValidationError(ContentValidationError),
    Error(OCError),
}
