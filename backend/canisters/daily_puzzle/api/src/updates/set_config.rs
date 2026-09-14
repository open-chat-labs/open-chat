use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{DailyPuzzleConfig, UnitResult};

#[ts_export(daily_puzzle, set_config)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub config: DailyPuzzleConfig,
}

pub type Response = UnitResult;
