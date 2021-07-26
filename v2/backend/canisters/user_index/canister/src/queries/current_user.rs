use crate::canister::RUNTIME_STATE;
use crate::model::runtime_state::RuntimeState;
use crate::model::user::{CanisterCreationStatus, CanisterUpgradeStatus, User};
use candid::CandidType;
use ic_cdk_macros::query;
use phonenumber::Mode;
use serde::Deserialize;
use shared::types::UserId;

#[derive(Deserialize)]
struct Args {}

#[derive(CandidType)]
enum Response {
    UserNotFound,
    Unconfirmed(UnconfirmedResult),
    ConfirmedPendingUsername(ConfirmedPendingUsernameResult),
    Confirmed(ConfirmedResult),
    Created(CreatedResult),
}

#[derive(CandidType)]
struct PhoneNumber {
    country_code: u16,
    number: String,
}

#[derive(CandidType)]
struct UnconfirmedResult {
    phone_number: PhoneNumber,
}

#[derive(CandidType)]
struct ConfirmedPendingUsernameResult {
    canister_creation_status: CanisterCreationStatus,
}

#[derive(CandidType)]
struct ConfirmedResult {
    username: String,
    canister_creation_status: CanisterCreationStatus,
}

#[derive(CandidType)]
struct CreatedResult {
    user_id: UserId,
    username: String,
    account_balance: u128,
    canister_upgrade_status: CanisterUpgradeStatus,
}

#[query]
fn current_user(_args: Args) -> Response {
    RUNTIME_STATE.with(|state| current_user_impl(state.borrow().as_ref().unwrap()))
}

fn current_user_impl(runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let latest_wasm_version = &runtime_state.data.user_wasm.version;

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
            User::Created(u) => {
                let canister_upgrade_status = if u.upgrade_in_progress {
                    CanisterUpgradeStatus::InProgress
                } else if &u.wasm_version < latest_wasm_version {
                    CanisterUpgradeStatus::Required
                } else {
                    CanisterUpgradeStatus::NotRequired
                };

                Response::Created(CreatedResult {
                    user_id: u.user_id,
                    username: u.username.clone(),
                    account_balance: 0,
                    canister_upgrade_status,
                })
            }
        }
    } else {
        Response::UserNotFound
    }
}
