use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::PhoneNumber;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub phone_number: PhoneNumber,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    AlreadyRegistered,
    AlreadyRegisteredByOther,
    InvalidPhoneNumber,
    UserNotFound,
}
