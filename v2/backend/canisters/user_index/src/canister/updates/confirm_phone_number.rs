use candid::CandidType;
use crate::canister::RUNTIME_STATE;
use crate::model::data::CONFIRMATION_CODE_EXPIRY_MILLIS;
use crate::model::user::{CanisterCreationStatus, ConfirmedUser, User};
use crate::model::runtime_state::RuntimeState;
use ic_cdk_macros::update;
use phonenumber::PhoneNumber;
use serde::Deserialize;

#[update]
fn confirm_phone_number(request: Request) -> Response {
    RUNTIME_STATE.with(|state| {
        confirm_phone_number_impl(request, state.borrow_mut().as_mut().unwrap())
    })
}

fn confirm_phone_number_impl(request: Request, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let now = runtime_state.env.now();

    let phone_number: PhoneNumber;
    if let Some(user) = runtime_state.data.users.get_by_principal(&caller) {
        match user {
            User::Unconfirmed(u) => {
                let code_expires_at = u.date_generated + CONFIRMATION_CODE_EXPIRY_MILLIS;
                let has_code_expired = now > code_expires_at;
                if has_code_expired {
                    return Response::ConfirmationCodeExpired;
                } else if request.confirmation_code != u.confirmation_code {
                    return Response::ConfirmationCodeIncorrect;
                } else {
                    phone_number = u.phone_number.clone();
                }
            },
            _ => return Response::AlreadyClaimed
        }
    } else {
        return Response::UserNotFound
    }

    let user = ConfirmedUser {
        principal: caller,
        phone_number,
        user_id: None,
        username: None,
        date_confirmed: now,
        canister_creation_status: CanisterCreationStatus::Pending
    };
    runtime_state.data.users.update(User::Confirmed(user));

    Response::Success
}

#[derive(Deserialize)]
pub struct Request {
    confirmation_code: String
}

#[derive(CandidType)]
pub enum Response {
    Success,
    ConfirmationCodeIncorrect,
    ConfirmationCodeExpired,
    AlreadyClaimed,
    UserNotFound,
}
