use serde::{Deserialize, Serialize};
use types::{ChatEventType, UnitResult, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub api_key_secret: String,
    pub event_types: Vec<ChatEventType>,
}

pub type Response = UnitResult;
