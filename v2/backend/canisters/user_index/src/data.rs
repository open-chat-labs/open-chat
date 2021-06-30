use candid::Principal;
use crate::model::confirmation_code_sms::ConfirmationCodeSms;
use crate::model::user::{ConfirmedUser, UnconfirmedUser, User};
use multi_map::MultiMap;
use phonenumber::PhoneNumber;
use shared::time::{TimestampMillis, Milliseconds};
use std::collections::VecDeque;

pub mod submit_phone_number;
pub mod confirm_phone_number;
pub mod resend_code;
pub mod status;
pub mod pending_sms_messages;

pub const CONFIRMATION_CODE_EXPIRY_MILLIS: u64 = 60 * 60 * 1000; // 1 hour

#[derive(Default)]
pub struct Data {
    users: MultiMap<Principal, PhoneNumber, User>,
    sms_queue: VecDeque<ConfirmationCodeSms>,
}

impl Data {
    pub fn submit_phone_number(&mut self, request: submit_phone_number::Request) -> submit_phone_number::Result {
        if let Some(user) = self.users.get_alt(&request.phone_number) {
            match user {
                User::Unconfirmed(u) => {
                    let code_expires_at = u.date_generated + CONFIRMATION_CODE_EXPIRY_MILLIS;
                    let has_code_expired = request.now > code_expires_at;
                    if u.principal == request.caller {
                        let time_until_resend_confirmation_code_permitted = if has_code_expired { None } else { Some(code_expires_at - request.now) };
                        return submit_phone_number::Result::AlreadyRegisteredButUnclaimed(time_until_resend_confirmation_code_permitted);
                    } else if !has_code_expired {
                        return submit_phone_number::Result::AlreadyRegisteredByOther;
                    }
                },
                _ => {
                    if user.get_principal() == request.caller {
                        return submit_phone_number::Result::AlreadyRegistered;
                    } else {
                        // TODO we should support the case where a phone number is recycled
                        return submit_phone_number::Result::AlreadyRegisteredByOther;
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

        submit_phone_number::Result::Success
    }

    pub fn confirm_phone_number(&mut self, request: confirm_phone_number::Request) -> confirm_phone_number::Result {
        let phone_number: PhoneNumber;
        if let Some(user) = self.users.get(&request.caller) {
            match user {
                User::Unconfirmed(u) => {
                    let code_expires_at = u.date_generated + CONFIRMATION_CODE_EXPIRY_MILLIS;
                    let has_code_expired = request.now > code_expires_at;
                    if has_code_expired {
                        return confirm_phone_number::Result::ConfirmationCodeExpired;
                    } else if request.confirmation_code != u.confirmation_code {
                        return confirm_phone_number::Result::ConfirmationCodeIncorrect;
                    } else {
                        phone_number = u.phone_number.clone();
                    }
                },
                _ => return confirm_phone_number::Result::AlreadyClaimed
            }
        } else {
            return confirm_phone_number::Result::NotFound
        }

        let user = ConfirmedUser {
            principal: request.caller,
            phone_number: phone_number.clone(),
            user_id: None,
            username: None,
            date_confirmed: request.now
        };
        self.users.insert(request.caller, phone_number.clone(), User::Confirmed(user));

        confirm_phone_number::Result::Success(phone_number)
    }

    pub fn resend_code(&mut self, request: resend_code::Request) -> resend_code::Result {
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
                        resend_code::Result::Success
                    } else {
                        resend_code::Result::CodeNotExpiredYet(code_expires_at - request.now)
                    }
                },
                _ => resend_code::Result::AlreadyClaimed
            }
        } else {
            resend_code::Result::NotFound
        }
    }

    pub fn status(&self, request: status::Request) -> status::Result {
        if let Some(user) = self.users.get(&request.caller) {
            match user {
                User::Unconfirmed(u) => {
                    let code_expires_at = u.date_generated + CONFIRMATION_CODE_EXPIRY_MILLIS;
                    let has_code_expired = request.now > code_expires_at;
                    let time_until_resend_code_permitted = if has_code_expired { None } else { Some(code_expires_at - request.now) };
                    status::Result::Unconfirmed(status::UnconfirmedResult {
                        phone_number: u.phone_number.clone(),
                        time_until_resend_code_permitted
                    })
                },
                User::Confirmed(u) => {
                    if u.username.is_none() {
                        status::Result::ConfirmedPendingUsername
                    } else {
                        status::Result::ConfirmedPendingCanisterCreation
                    }
                }
                User::Created(u) => status::Result::Created(u.user_id)
            }
        } else {
            status::Result::NotFound
        }
    }

    pub fn pending_sms_messages(&self, request: pending_sms_messages::Request) -> pending_sms_messages::Result {
        let mut sms_messages = Vec::new();
        if let Some(earliest_index) = self.sms_queue.back().map(|s| s.index) {
            let from_index = request.from_index - earliest_index;
            for i in from_index..(from_index + request.max_results) {
                if let Some(message) = self.sms_queue.get(i as usize) {
                    sms_messages.push(message.clone());
                } else {
                    break;
                }
            }

        }

        pending_sms_messages::Result {
            sms_messages
        }
    }

    fn append_sms_to_queue(queue: &mut VecDeque<ConfirmationCodeSms>, phone_number: PhoneNumber, confirmation_code: String) {
        let index = queue.front().map_or(0, |s| s.index + 1);
        let sms = ConfirmationCodeSms {
            phone_number: phone_number.to_string(),
            confirmation_code,
            index
        };
        queue.push_front(sms);
    }
}
