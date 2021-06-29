use candid::CandidType;
use phonenumber::PhoneNumber;

#[allow(dead_code)]
#[derive(Clone, CandidType)]
pub struct ConfirmationCodeSms {
    phone_number: String,
    confirmation_code: String,
    index: u64,
}

impl ConfirmationCodeSms {
    pub fn new(phone_number: PhoneNumber, confirmation_code: String, index: u64) -> ConfirmationCodeSms {
        ConfirmationCodeSms {
            phone_number: phone_number.to_string(),
            confirmation_code,
            index
        }
    }

    pub fn get_index(&self) -> u64 {
        self.index
    }
}