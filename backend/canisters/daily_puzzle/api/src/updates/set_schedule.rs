use crate::PuzzleParams;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UnitResult;

#[ts_export(daily_puzzle, set_schedule)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    /// Length 7, indexed by weekday (0 = Monday).
    pub schedule: Vec<PuzzleParams>,
}

pub type Response = UnitResult;
