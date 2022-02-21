use candid::CandidType;
use serde::Deserialize;
use types::PhoneNumber;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub phone_number: PhoneNumber,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    AlreadyRegistered,
    AlreadyRegisteredByOther,
    InvalidPhoneNumber,
    UserNotFound,
}
