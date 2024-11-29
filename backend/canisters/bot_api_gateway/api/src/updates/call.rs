use crate::c2c_handle_bot_action::HandleBotActionsError;
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{BotAction, CanisterId, Chat, UserId};

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
