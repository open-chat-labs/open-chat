use super::*;

pub struct Request {
    pub caller: Principal,
    pub now: TimestampMillis,
}

pub enum Result {
    NotFound,
    Unconfirmed(UnconfirmedResult),
    ConfirmedPendingUsername,
    ConfirmedPendingCanisterCreation,
    Created(Principal)
}

pub struct UnconfirmedResult {
    pub phone_number: PhoneNumber,
    pub time_until_resend_code_permitted: Option<Milliseconds>
}
