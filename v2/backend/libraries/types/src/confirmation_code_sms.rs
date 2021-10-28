use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ConfirmationCodeSms {
    pub phone_number: String,
    pub confirmation_code: String,
}
