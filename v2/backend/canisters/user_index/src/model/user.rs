use candid::{CandidType, Principal};
use phonenumber::PhoneNumber;
use shared::time::TimestampMillis;
use shared::types::UserId;

#[allow(dead_code)]
#[derive(Clone, Debug, Eq, PartialEq)]
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

    pub fn get_phone_number(&self) -> &PhoneNumber {
        match self {
            User::Unconfirmed(u) => &u.phone_number,
            User::Confirmed(u) => &u.phone_number,
            User::Created(u) => &u.phone_number,
        }
    }

    pub fn get_username(&self) -> Option<&str> {
        match self {
            User::Unconfirmed(_) => None,
            User::Confirmed(u) => u.username.as_ref().map(|u| u.as_str()),
            User::Created(u) => Some(&u.username),
        }
    }

    pub fn get_user_id(&self) -> Option<Principal> {
        match self {
            User::Unconfirmed(_) => None,
            User::Confirmed(u) => u.user_id,
            User::Created(u) => Some(u.user_id)
        }
    }

    pub fn get_last_online(&self) -> Option<TimestampMillis> {
        match self {
            User::Created(u) => Some(u.last_online),
            _ => None
        }
    }

    #[allow(dead_code)]
    pub fn set_phone_number(&mut self, phone_number: PhoneNumber) {
        match self {
            User::Unconfirmed(u) => u.phone_number = phone_number,
            User::Confirmed(u) => u.phone_number = phone_number,
            User::Created(u) => u.phone_number = phone_number,
        }
    }

    pub fn set_username(&mut self, username: String) -> bool {
        match self {
            User::Unconfirmed(_) => return false,
            User::Confirmed(u) => u.username = Some(username),
            User::Created(u) => u.username = username,
        }
        true
    }

    pub fn set_last_online(&mut self, now: TimestampMillis) -> bool {
        match self {
            User::Created(u) => { 
                u.last_online = now;
                true
            },
            _ => false
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UnconfirmedUser {
    pub principal: Principal,
    pub phone_number: PhoneNumber,
    pub confirmation_code: String,
    pub date_generated: TimestampMillis,
    pub sms_messages_sent: u16,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ConfirmedUser {
    pub principal: Principal,
    pub phone_number: PhoneNumber,
    pub user_id: Option<UserId>,
    pub username: Option<String>,
    pub canister_creation_status: CanisterCreationStatus,
    pub date_confirmed: TimestampMillis,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CreatedUser {
    pub principal: Principal,
    pub phone_number: PhoneNumber,
    pub user_id: UserId,
    pub username: String,
    pub date_created: TimestampMillis,
    pub last_online: TimestampMillis,
}

#[allow(dead_code)]
#[derive(CandidType, Clone, Copy, Debug, Eq, PartialEq)]
pub enum CanisterCreationStatus {
    Pending,
    InProgress,
    Created,
}