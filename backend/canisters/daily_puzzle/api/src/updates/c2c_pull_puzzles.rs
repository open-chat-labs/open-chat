use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::{DailyPuzzle, Empty};

pub type Args = Empty;

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Vec<DailyPuzzle>),
    Error(OCError),
}
