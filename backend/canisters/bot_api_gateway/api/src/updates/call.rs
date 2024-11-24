use crate::c2c_handle_bot_actions::HandleBotActionsError;
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{BotAction, CanisterId, Chat, UserId};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub bot_user_id: UserId,
    pub target_canister_id: CanisterId,
    pub actions: Vec<BotAction>,
    pub jwt: String,
}

pub type Response = Result<(), BotApiCallError>;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum BotApiCallError {
    Invalid(String),
    CanisterError(HandleBotActionsError),
    C2CError(i32, String),
}
