use candid::CandidType;
use serde::Deserialize;
use types::CanisterId;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(CanisterId),
    UserNotFound,
    UserUnconfirmed,
    UserAlreadyCreated,
    CreationInProgress,
    CyclesBalanceTooLow,
    InternalError(String),
}
