use phonenumber::PhoneNumber;

#[allow(dead_code)]
pub struct ConfirmationCodeSms {
    phone_number: PhoneNumber,
    confirmation_code: String,
    index: u64,
}

impl ConfirmationCodeSms {
    pub fn new(phone_number: PhoneNumber, confirmation_code: String, index: u64) -> ConfirmationCodeSms {
        ConfirmationCodeSms {
            phone_number,
            confirmation_code,
            index
        }
    }

    pub fn get_index(&self) -> u64 {
        self.index
    }
}