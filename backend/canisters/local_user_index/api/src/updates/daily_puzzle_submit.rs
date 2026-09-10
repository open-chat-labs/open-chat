use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{DailyPuzzleSolved, GameId, PuzzleNumber};

#[ts_export(local_user_index, daily_puzzle_submit)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub game_id: GameId,
    pub number: PuzzleNumber,
    #[serde(with = "serde_bytes")]
    pub grid: Vec<u8>,
}

#[ts_export(local_user_index, daily_puzzle_submit)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(DailyPuzzleSolved),
    Error(OCError),
}
