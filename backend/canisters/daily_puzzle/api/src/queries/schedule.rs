use crate::PuzzleParams;
use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::Empty;

pub type Args = Empty;

#[ts_export(daily_puzzle, schedule)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    /// Length 7, indexed by weekday (0 = Monday). What `set_schedule` last stored, or the default.
    Success(Vec<PuzzleParams>),
    Error(OCError),
}
