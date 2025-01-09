use candid::CandidType;
use serde::{Deserialize, Serialize};

use super::MessageContent;

#[derive(CandidType, Serialize, Clone)]
pub struct ActionArgs {
    pub action: BotAction,
    pub jwt: String,
}

pub type ActionResponse = Result<(), BotApiCallError>;

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum BotApiCallError {
    Invalid(String),
    CanisterError(CanisterError),
    C2CError(i32, String),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum CanisterError {
    NotAuthorized,
    Frozen,
    Other(String),
}

#[derive(CandidType, Serialize, Clone)]
pub enum BotAction {
    SendMessage(BotMessageAction),
}

#[derive(CandidType, Serialize, Clone)]
pub struct BotMessageAction {
    pub content: MessageContent,
    pub finalised: bool,
}
