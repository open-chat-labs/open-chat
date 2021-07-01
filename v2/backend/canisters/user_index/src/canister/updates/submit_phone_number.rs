use candid::CandidType;
use crate::canister::RUNTIME_STATE;
use crate::model::data::{CONFIRMATION_CODE_EXPIRY_MILLIS, append_sms_to_queue};
use crate::model::user::{UnconfirmedUser, User};
use crate::model::runtime_state::RuntimeState;
use crate::model::user_map::AddUserResult;
use ic_cdk_macros::update;
use phonenumber::PhoneNumber;
use serde::Deserialize;
use shared::time::Milliseconds;
use std::str::FromStr;

#[update]
fn submit_phone_number(request: Request) -> Response {
    RUNTIME_STATE.with(|state| {
        submit_phone_number_impl(request, state.borrow_mut().as_mut().unwrap())
    })
}

fn submit_phone_number_impl(request: Request, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let now = runtime_state.env.now();

    match PhoneNumber::from_str(&format!("+{} {}", request.phone_number.country_code, request.phone_number.number)) {
        Ok(phone_number) => {
            let mut sms_messages_sent = 0u16;

            if let Some(user) = runtime_state.data.users.get_by_principal(&caller) {
                match user {
                    User::Unconfirmed(u) => {
                        sms_messages_sent = u.sms_messages_sent;
                        runtime_state.data.users.remove_by_principal(&caller);
                    },
                    _ => return Response::AlreadyRegistered,
                }
            } else if let Some(user) = runtime_state.data.users.get_by_phone_number(&phone_number) {
                match user {
                    User::Unconfirmed(u) => {
                        let code_expires_at = u.date_generated + CONFIRMATION_CODE_EXPIRY_MILLIS;
                        let has_code_expired = now > code_expires_at;
                        if !has_code_expired {
                            return Response::AlreadyRegisteredByOther;
                        }
                    },
                    _ => {
                        return if user.get_principal() == caller {
                            Response::AlreadyRegistered
                        } else {
                            // TODO we should support the case where a phone number is recycled
                            Response::AlreadyRegisteredByOther
                        }
                    }
                }
            }

            let confirmation_code = format!("{:0>6}", runtime_state.env.random_u32());

            let user = UnconfirmedUser {
                principal: caller,
                phone_number: phone_number.clone(),
                confirmation_code: confirmation_code.clone(),
                date_generated: now,
                sms_messages_sent: sms_messages_sent + 1
            };

            if matches!(runtime_state.data.users.add(User::Unconfirmed(user)), AddUserResult::Success) {
                append_sms_to_queue(&mut runtime_state.data.sms_queue, phone_number, confirmation_code);
                Response::Success
            } else {
                panic!("Failed to add user");
            }
        },
        Err(_) => Response::InvalidPhoneNumber
    }
}

#[derive(Deserialize)]
pub struct Request {
    phone_number: UnvalidatedPhoneNumber,
}

#[derive(Deserialize)]
pub struct UnvalidatedPhoneNumber {
    country_code: u16,
    number: String,
}

#[derive(CandidType)]
pub enum Response {
    Success,
    AlreadyRegistered,
    AlreadyRegisteredByOther,
    InvalidPhoneNumber,
}

#[derive(CandidType)]
pub struct AlreadyRegisteredButUnclaimedResult {
    time_until_resend_code_permitted: Option<Milliseconds>
}
