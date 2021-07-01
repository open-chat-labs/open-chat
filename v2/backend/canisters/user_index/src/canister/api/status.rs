use candid::{CandidType, Principal};
use crate::canister::RUNTIME_STATE;
use crate::model::user::User;
use crate::model::runtime_state::RuntimeState;
use ic_cdk_macros::query;
use phonenumber::{Mode};
use serde::Deserialize;

#[query]
fn status(_: Request) -> Response {
    RUNTIME_STATE.with(|state| {
        status_impl(state.borrow().as_ref().unwrap())
    })
}

fn status_impl(runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();

    if let Some(user) = runtime_state.data.users.get_by_principal(&caller) {
        match user {
            User::Unconfirmed(u) => {
                Response::Unconfirmed(UnconfirmedResult {
                    phone_number: PhoneNumber {
                        country_code: u.phone_number.code().value(),
                        number: u.phone_number.format().mode(Mode::National).to_string()
                    }
                })
            },
            User::Confirmed(u) => {
                if u.username.is_none() {
                    Response::ConfirmedPendingUsername
                } else {
                    Response::ConfirmedPendingCanisterCreation
                }
            }
            User::Created(u) => Response::Created(CreatedResult { user_id: u.user_id })
        }
    } else {
        Response::UserNotFound
    }
}

#[derive(Deserialize)]
pub struct Request {
}

#[derive(CandidType)]
pub enum Response {
    UserNotFound,
    Unconfirmed(UnconfirmedResult),
    ConfirmedPendingUsername,
    ConfirmedPendingCanisterCreation,
    Created(CreatedResult),
}

#[derive(CandidType)]
pub struct PhoneNumber {
    country_code: u16,
    number: String,
}

#[derive(CandidType)]
pub struct UnconfirmedResult {
    phone_number: PhoneNumber,
}

#[derive(CandidType)]
pub struct CreatedResult {
    user_id: Principal,
}

