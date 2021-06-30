use super::*;

pub struct Request {
    pub caller: Principal,
    pub username: String,
    pub now: TimestampMillis,
}

pub enum Result {
    Success,
    UsernameTaken,
    UserUnconfirmed,
    UserNotFound,
}
