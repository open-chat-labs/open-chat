use candid::{Principal};
use crate::domain::confirmation_code_sms::ConfirmationCodeSms;
use crate::domain::phone_number_state::{PhoneNumberState, UnclaimedPhoneNumberState, ClaimedPhoneNumberState};
use crate::domain::phone_number_state::PhoneNumberState::{Claimed, Unclaimed};
use phonenumber::PhoneNumber;
use shared::time::{TimestampMillis, Milliseconds};
use std::collections::{HashMap, VecDeque};

pub const CONFIRMATION_CODE_EXPIRY_MILLIS: u64 = 60 * 60 * 1000; // 1 hour

#[derive(Default)]
pub struct PhoneIndex {
    // TODO move these 2 maps into a single struct which ensures consistency
    principal_to_phone_number_map: HashMap<Principal, PhoneNumber>,
    phone_numbers: HashMap<PhoneNumber, PhoneNumberState>,
    sms_queue: VecDeque<ConfirmationCodeSms>,
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

        let state = Unclaimed(UnclaimedPhoneNumberState::new(request.caller, request.confirmation_code.clone(), request.now));
        if let Some(existing) = self.phone_numbers.insert(request.phone_number.clone(), state) {
            // Unlink the old principal from this phone number
            self.principal_to_phone_number_map.remove(&existing.get_principal());
        }
        self.principal_to_phone_number_map.insert(request.caller, request.phone_number.clone());
        Self::append_sms_to_queue(&mut self.sms_queue, request.phone_number, request.confirmation_code);

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

    pub fn resend_code(&mut self, request: ResendCodeRequest) -> ResendCodeResult {
        if let Some(phone_number) = self.principal_to_phone_number_map.get(&request.caller) {
            match self.phone_numbers.get(phone_number).unwrap() {
                Claimed(_) => {
                    return ResendCodeResult::AlreadyClaimed
                },
                Unclaimed(s) => {
                    let code_expires_at = s.get_date_generated() + CONFIRMATION_CODE_EXPIRY_MILLIS;
                    let has_code_expired = request.now > code_expires_at;
                    if !has_code_expired {
                        Self::append_sms_to_queue(
                            &mut self.sms_queue,
                            phone_number.clone(),
                            s.get_confirmation_code().to_string());
                        ResendCodeResult::Success
                    } else {
                        ResendCodeResult::CodeNotExpiredYet(code_expires_at - request.now)
                    }
                }
            }
        } else {
            ResendCodeResult::NotFound
        }
    }

    pub fn status(&self, request: StatusRequest) -> StatusResult {
        if let Some(phone_number) = self.principal_to_phone_number_map.get(&request.caller) {
            match self.phone_numbers.get(phone_number).unwrap() {
                Unclaimed(uc) => {
                    let code_expires_at = uc.get_date_generated() + CONFIRMATION_CODE_EXPIRY_MILLIS;
                    let has_code_expired = request.now > code_expires_at;
                    let time_until_resend_code_permitted = if has_code_expired { None } else { Some(code_expires_at - request.now) };
                    StatusResult::Unclaimed(PhoneNumberResult {
                        phone_number: phone_number.clone(),
                        time_until_resend_code_permitted
                    })
                },
                Claimed(c) => {                
                    StatusResult::Claimed(c.get_principal())
                }
            }
        } else {
            StatusResult::NotFound
        }
    }

    fn append_sms_to_queue(queue: &mut VecDeque<ConfirmationCodeSms>, phone_number: PhoneNumber, confirmation_code: String) {
        let sms_index = queue.front().map_or(0, |s| s.get_index() + 1);
        let sms = ConfirmationCodeSms::new(phone_number, confirmation_code, sms_index);
        queue.push_front(sms);
    }
}

pub struct RegisterRequest {
    pub caller: Principal,
    pub phone_number: PhoneNumber,
    pub now: TimestampMillis,
    pub confirmation_code: String
}

pub enum RegisterResult {
    Success,
    AlreadyRegistered,
    AlreadyRegisteredByOther,
    AlreadyRegisteredButUnclaimed(Option<Milliseconds>),
}

pub struct ClaimRequest {
    pub caller: Principal,
    pub confirmation_code: String,
    pub now: TimestampMillis,
}

pub enum ClaimResult {
    Success(PhoneNumber),
    ConfirmationCodeIncorrect,
    ConfirmationCodeExpired,
    AlreadyClaimed,
    NotFound,
}

pub struct ResendCodeRequest {
    pub caller: Principal,
    pub now: TimestampMillis,
}

pub enum ResendCodeResult {
    Success,
    AlreadyClaimed,
    CodeNotExpiredYet(Milliseconds),
    NotFound,
}

pub struct StatusRequest {
    pub caller: Principal,
    pub now: TimestampMillis,
}

pub enum StatusResult {
    NotFound,
    Unclaimed(PhoneNumberResult),
    Claimed(Principal),
}

pub struct PhoneNumberResult {
    pub phone_number: PhoneNumber,
    pub time_until_resend_code_permitted: Option<Milliseconds>
}
