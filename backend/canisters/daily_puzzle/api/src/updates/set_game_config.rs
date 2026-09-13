use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{GameConfig, GameId, UnitResult};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub game_id: GameId,
    pub config: GameConfig,
}

pub type Response = UnitResult;
