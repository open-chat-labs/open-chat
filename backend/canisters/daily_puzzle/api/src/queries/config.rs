use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{DailyPuzzleConfig, Empty};

pub type Args = Empty;

#[ts_export(daily_puzzle, config)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(DailyPuzzleConfig),
    Error(OCError),
}
