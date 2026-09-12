use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{Empty, PublicDailyPuzzle};

pub type Args = Empty;

#[ts_export(daily_puzzle, current_puzzles)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Vec<PublicDailyPuzzle>),
    Error(OCError),
}
