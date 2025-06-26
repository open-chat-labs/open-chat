use serde::{Deserialize, Serialize};
use types::{BotInitiator, UnitResult, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub initiator: BotInitiator,
    pub user_id: UserId,
    pub block: bool,
}

pub type Response = UnitResult;
