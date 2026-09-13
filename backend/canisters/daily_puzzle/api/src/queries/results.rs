use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{DailyPuzzleResult, GameId, PuzzleNumber, UserId};

#[ts_export(daily_puzzle, results)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub game_id: GameId,
    pub number: PuzzleNumber,
    pub user_ids: Vec<UserId>,
}

#[ts_export(daily_puzzle, results)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Vec<DailyPuzzleResult>),
    Error(OCError),
}
