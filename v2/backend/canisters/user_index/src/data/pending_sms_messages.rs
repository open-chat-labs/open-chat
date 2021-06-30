use super::*;

pub struct Request {
    pub from_index: u64,
    pub max_results: u64,
}

pub struct Result {
    pub sms_messages: Vec<ConfirmationCodeSms>
}