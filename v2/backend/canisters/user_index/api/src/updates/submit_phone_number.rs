use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub phone_number: UnvalidatedPhoneNumber,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct UnvalidatedPhoneNumber {
    pub country_code: u16,
    pub number: String,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    AlreadyRegistered,
    AlreadyRegisteredByOther,
    InvalidPhoneNumber,
}
