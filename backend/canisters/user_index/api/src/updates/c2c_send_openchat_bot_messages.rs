use serde::{Deserialize, Serialize};
use types::SuccessOnly;

pub type Message = crate::OpenChatBotMessage;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub messages: Vec<Message>,
}

pub type Response = SuccessOnly;
