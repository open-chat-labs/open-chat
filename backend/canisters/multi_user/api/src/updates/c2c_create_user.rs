use candid::Principal;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::{MessageContentInitial, UserId};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub principal: Principal,
    pub username: String,
    pub referred_by: Option<UserId>,
    // The OpenChat bot's welcome messages, which are sent to the user once they are created
    #[serde(default)]
    pub openchat_bot_messages: Vec<MessageContentInitial>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(UserId),
    Error(OCError),
}
