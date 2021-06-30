use candid::{CandidType, Principal};
use multi_map::MultiMap;
use phonenumber::PhoneNumber;
use shared::time::{TimestampMillis, Milliseconds};
use std::collections::VecDeque;

pub const CONFIRMATION_CODE_EXPIRY_MILLIS: u64 = 60 * 60 * 1000; // 1 hour

#[derive(Default)]
pub struct Data {
    users: MultiMap<Principal, PhoneNumber, User>,
    sms_queue: VecDeque<ConfirmationCodeSms>,
}

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
    principal: Principal,
    phone_number: PhoneNumber,
    confirmation_code: String,
    date_generated: TimestampMillis,
}

#[allow(dead_code)]
pub struct ConfirmedUser {
    principal: Principal,
    phone_number: PhoneNumber,
    user_id: Option<Principal>,
    username: Option<String>,
    date_confirmed: TimestampMillis,
}

#[allow(dead_code)]
pub struct CreatedUser {
    principal: Principal,
    phone_number: PhoneNumber,
    user_id: Principal,
    username: Option<String>,
    date_created: TimestampMillis,
}

#[derive(Clone, CandidType)]
pub struct ConfirmationCodeSms {
    phone_number: String,
    confirmation_code: String,
    index: u64,
}

impl ConfirmationCodeSms {
    pub fn new(phone_number: PhoneNumber, confirmation_code: String, index: u64) -> ConfirmationCodeSms {
        ConfirmationCodeSms {
            phone_number: phone_number.to_string(),
            confirmation_code,
            index
        }
    }

    pub fn get_index(&self) -> u64 {
        self.index
    }
}

impl Data {
    pub fn submit_phone_number(&mut self, request: SubmitPhoneNumberRequest) -> SubmitPhoneNumberResult {
        if let Some(user) = self.users.get_alt(&request.phone_number) {
            match user {
                User::Unconfirmed(u) => {
                    let code_expires_at = u.date_generated + CONFIRMATION_CODE_EXPIRY_MILLIS;
                    let has_code_expired = request.now > code_expires_at;
                    if u.principal == request.caller {
                        let time_until_resend_confirmation_code_permitted = if has_code_expired { None } else { Some(code_expires_at - request.now) };
                        return SubmitPhoneNumberResult::AlreadyRegisteredButUnclaimed(time_until_resend_confirmation_code_permitted);
                    } else if !has_code_expired {
                        return SubmitPhoneNumberResult::AlreadyRegisteredByOther;
                    }
                },
                _ => {
                    if user.get_principal() == request.caller {
                        return SubmitPhoneNumberResult::AlreadyRegistered;
                    } else {
                        // TODO we should support the case where a phone number is recycled
                        return SubmitPhoneNumberResult::AlreadyRegisteredByOther;
                    }
                }
            }
        }

        let unconfirmed_user = UnconfirmedUser {
            principal: request.caller,
            phone_number: request.phone_number.clone(),
            confirmation_code: request.confirmation_code.clone(),
            date_generated: request.now
        };

        self.users.insert(
            request.caller,
            request.phone_number.clone(),
            User::Unconfirmed(unconfirmed_user));

        Self::append_sms_to_queue(&mut self.sms_queue, request.phone_number, request.confirmation_code);

        SubmitPhoneNumberResult::Success
    }

    pub fn confirm_phone_number(&mut self, request: ConfirmPhoneNumberRequest) -> ConfirmPhoneNumberResult {
        let phone_number: PhoneNumber;
        if let Some(user) = self.users.get(&request.caller) {
            match user {
                User::Unconfirmed(u) => {
                    let code_expires_at = u.date_generated + CONFIRMATION_CODE_EXPIRY_MILLIS;
                    let has_code_expired = request.now > code_expires_at;
                    if has_code_expired {
                        return ConfirmPhoneNumberResult::ConfirmationCodeExpired;
                    } else if request.confirmation_code != u.confirmation_code {
                        return ConfirmPhoneNumberResult::ConfirmationCodeIncorrect;
                    } else {
                        phone_number = u.phone_number.clone();
                    }
                },
                _ => return ConfirmPhoneNumberResult::AlreadyClaimed
            }
        } else {
            return ConfirmPhoneNumberResult::NotFound
        }

        let user = ConfirmedUser {
            principal: request.caller,
            phone_number: phone_number.clone(),
            user_id: None,
            username: None,
            date_confirmed: request.now
        };
        self.users.insert(request.caller, phone_number.clone(), User::Confirmed(user));
        ConfirmPhoneNumberResult::Success(phone_number)
    }

    pub fn resend_code(&mut self, request: ResendCodeRequest) -> ResendCodeResult {
        if let Some(user) = self.users.get(&request.caller) {
            match user {
                User::Unconfirmed(u) => {
                    let code_expires_at = u.date_generated + CONFIRMATION_CODE_EXPIRY_MILLIS;
                    let has_code_expired = request.now > code_expires_at;
                    if !has_code_expired {
                        Self::append_sms_to_queue(
                            &mut self.sms_queue,
                            u.phone_number.clone(),
                            u.confirmation_code.to_string());
                        ResendCodeResult::Success
                    } else {
                        ResendCodeResult::CodeNotExpiredYet(code_expires_at - request.now)
                    }
                },
                _ => ResendCodeResult::AlreadyClaimed
            }
        } else {
            ResendCodeResult::NotFound
        }
    }

    pub fn status(&self, request: StatusRequest) -> StatusResult {
        if let Some(user) = self.users.get(&request.caller) {
            match user {
                User::Unconfirmed(u) => {
                    let code_expires_at = u.date_generated + CONFIRMATION_CODE_EXPIRY_MILLIS;
                    let has_code_expired = request.now > code_expires_at;
                    let time_until_resend_code_permitted = if has_code_expired { None } else { Some(code_expires_at - request.now) };
                    StatusResult::Unconfirmed(UnconfirmedResult {
                        phone_number: u.phone_number.clone(),
                        time_until_resend_code_permitted
                    })
                },
                User::Confirmed(u) => {
                    if u.username.is_none() {
                        StatusResult::ConfirmedPendingUsername
                    } else {
                        StatusResult::ConfirmedPendingCanisterCreation
                    }
                }
                User::Created(u) => StatusResult::Created(u.user_id)
            }
        } else {
            StatusResult::NotFound
        }
    }

    pub fn pending_sms_messages(&self, request: PendingSmsMessagesRequest) -> PendingSmsMessagesResult {
        let mut sms_messages = Vec::new();
        if let Some(earliest_index) = self.sms_queue.back().map(|s| s.get_index()) {
            let from_index = request.from_index - earliest_index;
            for i in from_index..(from_index + request.max_results) {
                if let Some(message) = self.sms_queue.get(i as usize) {
                    sms_messages.push(message.clone());
                } else {
                    break;
                }
            }

        }

        PendingSmsMessagesResult {
            sms_messages
        }
    }

    fn append_sms_to_queue(queue: &mut VecDeque<ConfirmationCodeSms>, phone_number: PhoneNumber, confirmation_code: String) {
        let sms_index = queue.front().map_or(0, |s| s.get_index() + 1);
        let sms = ConfirmationCodeSms::new(phone_number, confirmation_code, sms_index);
        queue.push_front(sms);
    }
}

pub struct SubmitPhoneNumberRequest {
    pub caller: Principal,
    pub phone_number: PhoneNumber,
    pub now: TimestampMillis,
    pub confirmation_code: String
}

pub enum SubmitPhoneNumberResult {
    Success,
    AlreadyRegistered,
    AlreadyRegisteredByOther,
    AlreadyRegisteredButUnclaimed(Option<Milliseconds>),
}

pub struct ConfirmPhoneNumberRequest {
    pub caller: Principal,
    pub confirmation_code: String,
    pub now: TimestampMillis,
}

pub enum ConfirmPhoneNumberResult {
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
    Unconfirmed(UnconfirmedResult),
    ConfirmedPendingUsername,
    ConfirmedPendingCanisterCreation,
    Created(Principal)
}

pub struct UnconfirmedResult {
    pub phone_number: PhoneNumber,
    pub time_until_resend_code_permitted: Option<Milliseconds>
}

pub struct PendingSmsMessagesRequest {
    pub from_index: u64,
    pub max_results: u64,
}

pub struct PendingSmsMessagesResult {
    pub sms_messages: Vec<ConfirmationCodeSms>
}
