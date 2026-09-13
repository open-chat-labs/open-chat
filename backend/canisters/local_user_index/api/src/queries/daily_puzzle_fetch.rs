use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{DailyPuzzleUserState, Empty, PublicDailyPuzzle};

pub type Args = Empty;

#[ts_export(local_user_index, daily_puzzle_fetch)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(FetchResult),
}

#[ts_export(local_user_index, daily_puzzle_fetch)]
#[derive(Serialize, Deserialize, Debug)]
pub struct FetchResult {
    /// Today's enabled puzzles, one per game. Empty when none is available.
    pub puzzles: Vec<PublicDailyPuzzle>,
    /// One per entry in `puzzles`, matched by `game_id`; `started_at` is None if the user has not
    /// started that game. `streak` and `has_solved_before` are series-level, the same on each.
    pub states: Vec<DailyPuzzleUserState>,
}
