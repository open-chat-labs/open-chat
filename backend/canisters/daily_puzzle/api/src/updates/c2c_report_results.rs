use serde::{Deserialize, Serialize};
use types::{DailyPuzzleResult, UnitResult};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub results: Vec<DailyPuzzleResult>,
}

pub type Response = UnitResult;
