use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{GameConfig, GameId, UnitResult};

#[ts_export(daily_puzzle, set_game_config)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub game_id: GameId,
    pub config: GameConfig,
}

pub type Response = UnitResult;
