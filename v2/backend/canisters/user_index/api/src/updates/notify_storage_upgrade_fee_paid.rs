use candid::CandidType;
use serde::Deserialize;
use types::ICP;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub new_storage_limit_bytes: u64,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    SuccessNoChange,
    PaymentInsufficient(PaymentInsufficientResult),
    PaymentNotFound,
    StorageLimitExceeded(u64), // Returns the storage limit in bytes
    UserNotFound,
    InternalError(String),
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub remaining_account_credit: ICP,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct PaymentInsufficientResult {
    pub account_credit: ICP,
    pub amount_required: ICP,
}
