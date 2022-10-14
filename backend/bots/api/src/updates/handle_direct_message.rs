use serde::{Deserialize, Serialize};
use types::BotMessage;

pub type Args = user_canister::c2c_send_message::Args;

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub bot_name: String,
    pub messages: Vec<BotMessage>,
}
