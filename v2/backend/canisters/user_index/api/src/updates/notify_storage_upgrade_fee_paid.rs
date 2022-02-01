use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    PaymentInsufficient,
    PaymentNotFound,
    UserNotFound,
    InternalError(String),
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub open_storage_bytes_limit: u64,
}
