use serde::{Deserialize, Serialize};
use types::{DailyPuzzle, UnitResult};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    /// The full set for the current day, one per game. Replaces whatever is held.
    pub puzzles: Vec<DailyPuzzle>,
}

pub type Response = UnitResult;
