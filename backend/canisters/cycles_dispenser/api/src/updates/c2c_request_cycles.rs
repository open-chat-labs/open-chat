use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Cycles, Milliseconds};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub amount: Option<Cycles>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Cycles),
    TopUpInProgress,
    Throttled(Milliseconds),
    CyclesBalanceTooLow,
    NotAuthorized,
    InternalError(String),
}
