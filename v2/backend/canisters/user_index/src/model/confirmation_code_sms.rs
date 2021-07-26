use candid::CandidType;
use serde::Deserialize;

#[derive(Clone, CandidType, Deserialize)]
pub struct ConfirmationCodeSms {
    pub phone_number: String,
    pub confirmation_code: String,
}
