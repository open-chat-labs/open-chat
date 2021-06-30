use super::*;

pub struct Request {
    pub caller: Principal,
    pub phone_number: PhoneNumber,
    pub now: TimestampMillis,
    pub confirmation_code: String
}

pub enum Result {
    Success,
    AlreadyRegistered,
    AlreadyRegisteredByOther,
    AlreadyRegisteredButUnclaimed(Option<Milliseconds>),
}
