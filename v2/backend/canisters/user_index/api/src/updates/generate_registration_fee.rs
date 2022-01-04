use candid::CandidType;
use serde::Deserialize;
use types::{Cryptocurrency, RegistrationFee};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub currency: Cryptocurrency,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    AlreadyRegistered,
    InvalidCurrency,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub fee: RegistrationFee,
}
