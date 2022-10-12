use serde::{Deserialize, Serialize};
use types::BotMessage;

pub type Args = user_canister::c2c_send_message::Args;

#[derive(Serialize, Deserialize)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(Serialize, Deserialize)]
pub struct SuccessResult {
    pub bot_name: String,
    pub messages: Vec<BotMessage>,
}
