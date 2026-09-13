use crate::CandidateView;
use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::PuzzleNumber;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub number: PuzzleNumber,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Vec<CandidateView>),
    Error(OCError),
}
