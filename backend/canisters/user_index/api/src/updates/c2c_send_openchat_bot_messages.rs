use serde::{Deserialize, Serialize};
use types::{SuccessOnly, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub messages: Vec<Message>,
}

pub type Response = SuccessOnly;

#[derive(Serialize, Deserialize, Debug)]
pub struct Message {
    pub recipient: UserId,
    pub text: String,
}
