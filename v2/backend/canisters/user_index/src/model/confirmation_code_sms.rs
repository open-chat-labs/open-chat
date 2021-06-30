use candid::CandidType;

#[derive(Clone, CandidType)]
pub struct ConfirmationCodeSms {
    pub phone_number: String,
    pub confirmation_code: String,
    pub index: u64,
}