use candid::Principal;
use phonenumber::PhoneNumber;
use shared::time::TimestampMillis;

#[allow(dead_code)]
pub enum User {
    Unconfirmed(UnconfirmedUser),
    Confirmed(ConfirmedUser),
    Created(CreatedUser),
}

impl User {
    pub fn get_principal(&self) -> Principal {
        match self {
            User::Unconfirmed(u) => u.principal,
            User::Confirmed(u) => u.principal,
            User::Created(u) => u.principal,
        }
    }
}

pub struct UnconfirmedUser {
    pub principal: Principal,
    pub phone_number: PhoneNumber,
    pub confirmation_code: String,
    pub date_generated: TimestampMillis,
}

#[allow(dead_code)]
pub struct ConfirmedUser {
    pub principal: Principal,
    pub phone_number: PhoneNumber,
    pub user_id: Option<Principal>,
    pub username: Option<String>,
    pub date_confirmed: TimestampMillis,
}

#[allow(dead_code)]
pub struct CreatedUser {
    pub principal: Principal,
    pub phone_number: PhoneNumber,
    pub user_id: Principal,
    pub username: Option<String>,
    pub date_created: TimestampMillis,
}
