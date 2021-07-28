use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub confirmation_code: String,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success,
    ConfirmationCodeIncorrect,
    ConfirmationCodeExpired,
    AlreadyClaimed,
    UserNotFound,
}
