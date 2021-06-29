use candid::{Principal};
use crate::domain::phone_number_state::{PhoneNumberState, UnclaimedPhoneNumberState, ClaimedPhoneNumberState};
use crate::domain::phone_number_state::PhoneNumberState::{Claimed, Unclaimed};
use phonenumber::PhoneNumber;
use shared::time::{TimestampMillis, Milliseconds};
use std::collections::HashMap;

pub const CONFIRMATION_CODE_EXPIRY_MILLIS: u64 = 60 * 60 * 1000; // 1 hour

#[derive(Default)]
pub struct PhoneIndex {
    // TODO move these 2 maps into a single struct which ensures consistency
    principal_to_phone_number_map: HashMap<Principal, PhoneNumber>,
    phone_numbers: HashMap<PhoneNumber, PhoneNumberState>,
}

impl PhoneIndex {
    pub fn register(&mut self, request: RegisterRequest) -> RegisterResult {
        if let Some(existing) = self.phone_numbers.get(&request.phone_number) {
            match existing {
                Claimed(s) => {
                    // TODO we should support the case where a phone number is recycled
                    return if s.get_principal() == request.caller {
                        RegisterResult::AlreadyRegistered
                    } else {
                        RegisterResult::AlreadyRegisteredByOther
                    };
                },
                Unclaimed(s) => {
                    let code_expires_at = s.get_date_generated() + CONFIRMATION_CODE_EXPIRY_MILLIS;
                    let has_code_expired = request.now > code_expires_at;
                    if s.get_principal() == request.caller {
                        let time_until_resend_confirmation_code_permitted = if has_code_expired { None } else { Some(code_expires_at - request.now) };
                        return RegisterResult::AlreadyRegisteredButUnclaimed(time_until_resend_confirmation_code_permitted);
                    } else if !has_code_expired {
                        return RegisterResult::AlreadyRegisteredByOther;
                    }
                }
            }
        }

        let state = Unclaimed(UnclaimedPhoneNumberState::new(request.caller, request.confirmation_code, request.now));
        if let Some(existing) = self.phone_numbers.insert(request.phone_number.clone(), state) {
            // Unlink the old principal from this phone number
            self.principal_to_phone_number_map.remove(&existing.get_principal());
        }
        self.principal_to_phone_number_map.insert(request.caller, request.phone_number);

        RegisterResult::Success
    }

    pub fn claim(&mut self, request: ClaimRequest) -> ClaimResult {
        if let Some(phone_number) = self.principal_to_phone_number_map.get(&request.caller) {
            match self.phone_numbers.get(phone_number).unwrap() {
                Claimed(_) => {
                    return ClaimResult::AlreadyClaimed;
                },
                Unclaimed(s) => {
                    let code_expires_at = s.get_date_generated() + CONFIRMATION_CODE_EXPIRY_MILLIS;
                    let has_code_expired = request.now > code_expires_at;
                    if has_code_expired {
                        return ClaimResult::ConfirmationCodeExpired;
                    } else if request.confirmation_code != s.get_confirmation_code() {
                        return ClaimResult::ConfirmationCodeIncorrect;
                    }
                }
            }

            self.phone_numbers.insert(phone_number.clone(), Claimed(ClaimedPhoneNumberState::new(request.caller, request.now)));
            ClaimResult::Success(phone_number.clone())
        } else {
            ClaimResult::NotFound
        }
    }
}

pub struct RegisterRequest {
    caller: Principal,
    phone_number: PhoneNumber,
    now: TimestampMillis,
    confirmation_code: String
}

impl RegisterRequest {
    pub fn new(
        caller: Principal,
        phone_number: PhoneNumber,
        now: TimestampMillis,
        confirmation_code: String) -> RegisterRequest {

        RegisterRequest {
            caller,
            phone_number,
            now,
            confirmation_code
        }
    }
}

pub enum RegisterResult {
    Success,
    AlreadyRegistered,
    AlreadyRegisteredByOther,
    AlreadyRegisteredButUnclaimed(Option<Milliseconds>),
}

pub struct ClaimRequest {
    caller: Principal,
    confirmation_code: String,
    now: TimestampMillis,
}

impl ClaimRequest {
    pub fn new(caller: Principal, confirmation_code: String, now: TimestampMillis) -> ClaimRequest {
        ClaimRequest {
            caller,
            confirmation_code,
            now
        }
    }
}

pub enum ClaimResult {
    Success(PhoneNumber),
    ConfirmationCodeIncorrect,
    ConfirmationCodeExpired,
    AlreadyClaimed,
    NotFound,
}