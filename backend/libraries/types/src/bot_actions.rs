use candid::{CandidType, Deserialize};
use serde::Serialize;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum BotAction {
    SendTextMessage(SendTextMessageArgs),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct SendTextMessageArgs {
    pub text: String,
}
