use crate::canister::RUNTIME_STATE;
use crate::model::runtime_state::RuntimeState;
use crate::model::user::{CanisterCreationStatus, CreatedUser, User};
use crate::model::user_map::UpdateUserResult;
use crate::model::user_wasm::UserWasm;
use candid::Principal;
use ic_cdk::export::candid::CandidType;
use ic_cdk_macros::update;
use serde::Deserialize;
use shared::canisters;
use shared::canisters::create::CreateCanisterError;
use shared::types::CanisterId;

#[derive(Deserialize)]
pub struct Args {}

#[allow(dead_code)]
#[derive(CandidType)]
pub enum Response {
    Success(CanisterId),
    UserNotFound,
    UserUnconfirmed,
    UserAlreadyCreated,
    CreationInProgress,
    InternalError,
}

#[update]
async fn create_canister(_args: Args) -> Response {
    // Confirm the user needs a canister to be created.
    // Extract the user canister_id and wasm module from the runtime state.
    // Set the user's CanisterCreationStatus to InProgress.
    let init_ok = match RUNTIME_STATE.with(|state| initialize(state.borrow_mut().as_mut().unwrap())) {
        Err(response) => return response,
        Ok(ok) => ok,
    };

    // Make async calls to the management canister to create and install a user canister
    // If the create previously succeeded but the install failed then pass in the canister_id
    // and skip canister creation
    let wasm_module = init_ok.user_wasm.module;
    let wasm_version = init_ok.user_wasm.version;
    let wasm_arg = init_ok.user_principal.as_slice().to_vec();
    match canisters::create::call(init_ok.canister_id, wasm_module, wasm_arg).await {
        Ok(canister_id) => {
            // The canister create/install succeeded.
            // If the confirmed user record has a username then change the stored user from Confirmed to Created
            // otherwise set the user's CanisterCreationStatus to Created.
            RUNTIME_STATE.with(|state| commit(state.borrow_mut().as_mut().unwrap(), canister_id, wasm_version));
            Response::Success(canister_id)
        }
        Err(error) => {
            let mut canister_id = None;
            if let CreateCanisterError::InstallFailed((_, id)) = error {
                canister_id = Some(id);
            }
            // The canister create/install failed so set the user's CanisterCreationStatus back to Pending.
            // If the create succeeded but the install failed then set the user_id (aka canister_id)
            // on the user record.
            RUNTIME_STATE.with(|state| rollback(state.borrow_mut().as_mut().unwrap(), canister_id));
            Response::InternalError
        }
    }
}

struct InitOk {
    canister_id: Option<CanisterId>,
    user_wasm: UserWasm,
    user_principal: Principal,
}

fn initialize(runtime_state: &mut RuntimeState) -> Result<InitOk, Response> {
    let caller = runtime_state.env.caller();
    // Can we do better than cloning here?
    let user_wasm = runtime_state.data.user_wasm.clone();
    let response;
    if let Some(user) = runtime_state.data.users.get_by_principal(&caller) {
        response = match user {
            User::Unconfirmed(_) => Response::UserUnconfirmed,
            User::Created(_) => Response::UserAlreadyCreated,
            User::Confirmed(confirmed_user) => match confirmed_user.canister_creation_status {
                CanisterCreationStatus::Pending => {
                    let canister_id = confirmed_user.user_id.map(|u| u.into());
                    let user_principal = confirmed_user.principal;
                    let mut user = user.clone();
                    user.set_canister_creation_status(CanisterCreationStatus::InProgress);
                    match runtime_state.data.users.update(user) {
                        UpdateUserResult::Success => {
                            return Ok(InitOk {
                                canister_id,
                                user_wasm,
                                user_principal,
                            });
                        }
                        _ => Response::InternalError,
                    }
                }
                CanisterCreationStatus::InProgress => Response::CreationInProgress,
                CanisterCreationStatus::Created => Response::UserAlreadyCreated,
            },
        };
    } else {
        response = Response::UserNotFound;
    }

    Err(response)
}

fn commit(runtime_state: &mut RuntimeState, canister_id: CanisterId, wasm_version: semver::Version) {
    let caller = runtime_state.env.caller();
    let now = runtime_state.env.now();
    if let Some(user) = runtime_state.data.users.get_by_principal(&caller) {
        if let User::Confirmed(confirmed_user) = user {
            if let CanisterCreationStatus::InProgress = confirmed_user.canister_creation_status {
                let user_to_update = match &confirmed_user.username {
                    Some(username) => {
                        let created_user = CreatedUser {
                            principal: confirmed_user.principal,
                            phone_number: confirmed_user.phone_number.clone(),
                            user_id: canister_id.into(),
                            username: username.clone(),
                            date_created: now,
                            date_updated: now,
                            last_online: now,
                            wasm_version,
                            upgrade_in_progress: false,
                        };
                        User::Created(created_user)
                    }
                    None => {
                        let mut user = user.clone();
                        user.set_canister_creation_status(CanisterCreationStatus::Created);
                        user.set_user_id(canister_id.into());
                        user
                    }
                };
                runtime_state.data.users.update(user_to_update);
            }
        }
    }
}

fn rollback(runtime_state: &mut RuntimeState, canister_id: Option<CanisterId>) {
    let caller = runtime_state.env.caller();
    if let Some(user) = runtime_state.data.users.get_by_principal(&caller) {
        if let User::Confirmed(confirmed_user) = user {
            if let CanisterCreationStatus::InProgress = confirmed_user.canister_creation_status {
                let mut user = user.clone();
                user.set_canister_creation_status(CanisterCreationStatus::Pending);
                if let Some(canister_id) = canister_id {
                    user.set_user_id(canister_id.into());
                }
                runtime_state.data.users.update(user);
            }
        }
    }
}
