use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct ConfirmationCodeSms {
    pub phone_number: String,
    pub confirmation_code: String,
}
