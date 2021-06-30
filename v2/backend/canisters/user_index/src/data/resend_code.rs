use super::*;

pub struct Request {
    pub caller: Principal,
    pub now: TimestampMillis,
}

pub enum Result {
    Success,
    AlreadyClaimed,
    CodeNotExpiredYet(Milliseconds),
    NotFound,
}
