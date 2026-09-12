use crate::PuzzleParams;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::UnitResult;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    /// Length 7, indexed by weekday (0 = Monday).
    pub schedule: Vec<PuzzleParams>,
}

pub type Response = UnitResult;
