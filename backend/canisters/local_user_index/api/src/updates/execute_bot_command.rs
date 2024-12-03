use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{BotAction, HandleBotActionsError};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub action: BotAction,
    pub jwt: String,
}

pub type Response = Result<(), BotApiCallError>;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum BotApiCallError {
    Invalid(String),
    CanisterError(HandleBotActionsError),
    C2CError(i32, String),
}
