use crate::model::runtime_state::RuntimeState;
use crate::model::user::{CanisterCreationStatus, User};
use candid::CandidType;
use phonenumber::Mode;
use serde::Deserialize;
use shared::types::UserId;

pub fn query(runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();

    if let Some(user) = runtime_state.data.users.get_by_principal(&caller) {
        match user {
            User::Unconfirmed(u) => Response::Unconfirmed(UnconfirmedResult {
                phone_number: PhoneNumber {
                    country_code: u.phone_number.code().value(),
                    number: u.phone_number.format().mode(Mode::National).to_string(),
                },
            }),
            User::Confirmed(u) => {
                if u.username.is_none() {
                    Response::ConfirmedPendingUsername(ConfirmedPendingUsernameResult {
                        canister_creation_status: u.canister_creation_status,
                    })
                } else {
                    Response::Confirmed(ConfirmedResult {
                        canister_creation_status: u.canister_creation_status,
                        username: u.username.as_ref().unwrap().clone(),
                    })
                }
            }
            User::Created(u) => Response::Created(CreatedResult {
                user_id: u.user_id,
                username: u.username.clone(),
                account_balance: 0,
                upgrade_required: false,
            }),
        }
    } else {
        Response::UserNotFound
    }
}

#[derive(Deserialize)]
pub struct Request {}

#[allow(dead_code)]
#[derive(CandidType)]
pub enum Response {
    UserNotFound,
    Unconfirmed(UnconfirmedResult),
    ConfirmedPendingUsername(ConfirmedPendingUsernameResult),
    Confirmed(ConfirmedResult),
    Created(CreatedResult),
    UpgradeInProgress,
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
pub struct ConfirmedPendingUsernameResult {
    canister_creation_status: CanisterCreationStatus,
}

#[derive(CandidType)]
pub struct ConfirmedResult {
    username: String,
    canister_creation_status: CanisterCreationStatus,
}

#[derive(CandidType)]
pub struct CreatedResult {
    user_id: UserId,
    username: String,
    account_balance: u128,
    upgrade_required: bool,
}
