use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::BotMessage;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_name: String,
    pub messages: Vec<BotMessage>,
}

pub type Response = crate::c2c_send_message::Response;
