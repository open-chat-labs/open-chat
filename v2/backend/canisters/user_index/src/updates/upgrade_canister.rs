use crate::canister::RUNTIME_STATE;
use crate::model::runtime_state::RuntimeState;
use crate::model::user::User;
use crate::model::user_map::UpdateUserResult;
use crate::model::user_wasm::UserWasm;
use candid::Principal;
use ic_cdk::export::candid::CandidType;
use ic_cdk_macros::update;
use serde::Deserialize;
use shared::canisters;
use shared::types::CanisterId;

#[derive(Deserialize)]
pub struct Args {}

#[allow(dead_code)]
#[derive(CandidType)]
pub enum Response {
    Success,
    UserNotFound,
    UserNotCreated,
    UpgradeNotRequired,
    UpgradeInProgress,
    InternalError,
}

#[update]
async fn upgrade_canister(_args: Args) -> Response {
    // Confirm the user has a canister that needs upgrading.
    // Extract the user canister_id from the runtime state.
    // Set the user upgrade_in_progress flag to true.
    let init_ok = match RUNTIME_STATE.with(|state| initialize(state.borrow_mut().as_mut().unwrap())) {
        Err(response) => return response,
        Ok(ok) => ok,
    };

    // Make an async call to the management canister to upgrade the user canister
    let wasm_module = init_ok.user_wasm.module;
    let wasm_version = init_ok.user_wasm.version;
    let principal = init_ok.principal;
    match canisters::upgrade::call(init_ok.canister_id, wasm_module).await {
        Ok(_) => {
            // The canister upgrade succeeded.
            // Update the user with the new wasm version and reset the upgrade_in_progress flag to false.
            RUNTIME_STATE.with(|state| commit(state.borrow_mut().as_mut().unwrap(), principal, wasm_version));
            Response::Success
        }
        Err(_) => {
            // The canister upgrade failed so set reset the upgrade_in_progress flag to false.
            RUNTIME_STATE.with(|state| rollback(state.borrow_mut().as_mut().unwrap(), principal));
            Response::InternalError
        }
    }
}

struct InitOk {
    canister_id: CanisterId,
    principal: Principal,
    user_wasm: UserWasm,
}

fn initialize(runtime_state: &mut RuntimeState) -> Result<InitOk, Response> {
    let caller = runtime_state.env.caller();
    // Can we do better than cloning here?
    let user_wasm = runtime_state.data.user_wasm.clone();
    let response;
    if let Some(user) = runtime_state.data.users.get_by_principal(&caller) {
        response = match user {
            User::Created(created_user) => {
                if created_user.upgrade_in_progress {
                    Response::UpgradeInProgress
                } else if created_user.wasm_version >= user_wasm.version {
                    Response::UpgradeNotRequired
                } else {
                    let canister_id = created_user.user_id.into();
                    let mut user = user.clone();
                    user.set_canister_upgrade_status(true, None);
                    match runtime_state.data.users.update(user) {
                        UpdateUserResult::Success => {
                            return Ok(InitOk {
                                canister_id,
                                user_wasm,
                                principal: caller,
                            });
                        }
                        _ => Response::InternalError,
                    }
                }
            }
            _ => Response::UserNotCreated,
        };
    } else {
        response = Response::UserNotFound;
    }

    Err(response)
}

fn commit(runtime_state: &mut RuntimeState, principal: Principal, wasm_version: semver::Version) {
    if let Some(user) = runtime_state.data.users.get_by_principal(&principal) {
        if let User::Created(created_user) = user {
            if created_user.upgrade_in_progress {
                let mut user = user.clone();
                user.set_canister_upgrade_status(false, Some(wasm_version));
                runtime_state.data.users.update(user);
            }
        }
    }
}

fn rollback(runtime_state: &mut RuntimeState, principal: Principal) {
    if let Some(user) = runtime_state.data.users.get_by_principal(&principal) {
        if let User::Created(created_user) = user {
            if created_user.upgrade_in_progress {
                let mut user = user.clone();
                user.set_canister_upgrade_status(false, None);
                runtime_state.data.users.update(user);
            }
        }
    }
}
