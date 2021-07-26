use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub phone_number: UnvalidatedPhoneNumber,
}

#[derive(CandidType, Deserialize)]
pub struct UnvalidatedPhoneNumber {
    pub country_code: u16,
    pub number: String,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success,
    AlreadyRegistered,
    AlreadyRegisteredByOther,
    InvalidPhoneNumber,
}
