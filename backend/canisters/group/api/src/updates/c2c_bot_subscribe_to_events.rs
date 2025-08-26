use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use types::{ChatEventType, UnitResult, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub event_types: HashSet<ChatEventType>,
}

pub type Response = UnitResult;
