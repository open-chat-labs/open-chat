use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{DailyPuzzleConfig, UnitResult};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub config: DailyPuzzleConfig,
}

pub type Response = UnitResult;
