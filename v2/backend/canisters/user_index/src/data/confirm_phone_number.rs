use super::*;

pub struct Request {
    pub caller: Principal,
    pub confirmation_code: String,
    pub now: TimestampMillis,
}

pub enum Result {
    Success(PhoneNumber),
    ConfirmationCodeIncorrect,
    ConfirmationCodeExpired,
    AlreadyClaimed,
    NotFound,
}
