use serde::{Deserialize, Serialize};
use types::UserId;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub messages: Vec<Message>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Message {
    pub recipient: UserId,
    pub text: String,
}
