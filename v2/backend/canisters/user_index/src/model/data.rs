use crate::model::confirmation_code_sms::ConfirmationCodeSms;
use crate::model::user_map::UserMap;
use phonenumber::PhoneNumber;
use std::collections::VecDeque;

pub const CONFIRMATION_CODE_EXPIRY_MILLIS: u64 = 60 * 60 * 1000; // 1 hour

#[derive(Default)]
pub struct Data {
    pub users: UserMap,
    pub sms_queue: VecDeque<ConfirmationCodeSms>,
}

pub fn append_sms_to_queue(queue: &mut VecDeque<ConfirmationCodeSms>, phone_number: PhoneNumber, confirmation_code: String) {
    let index = queue.front().map_or(0, |s| s.index + 1);
    let sms = ConfirmationCodeSms {
        phone_number: phone_number.to_string(),
        confirmation_code,
        index,
    };
    queue.push_front(sms);
}
