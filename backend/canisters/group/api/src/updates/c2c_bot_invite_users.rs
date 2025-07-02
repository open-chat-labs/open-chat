use ic_principal::Principal;
use serde::{Deserialize, Serialize};
use types::{BotInitiator, UnitResult, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub initiator: BotInitiator,
    pub users: Vec<(UserId, Principal)>,
}

pub type Response = UnitResult;
