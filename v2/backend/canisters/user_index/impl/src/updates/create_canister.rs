use crate::model::user_map::UpdateUserResult;
use crate::{RuntimeState, MIN_CYCLES_BALANCE, RUNTIME_STATE, USER_CANISTER_INITIAL_CYCLES_BALANCE};
use candid::Principal;
use ic_cdk_macros::update;
use shared::canisters;
use shared::canisters::create::CreateCanisterError;
use shared::consts::CREATE_CANISTER_CYCLES_FEE;
use types::{CanisterCreationStatus, CanisterId, CanisterWasm, CreatedUser, User, Version};
use user_canister::lifecycle::init::Args as InitUserCanisterArgs;
use user_index_canister::updates::create_canister::{Response::*, *};

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
    let caller = init_ok.caller;
    let wasm_arg = candid::encode_one(init_ok.init_canister_args).unwrap();
    let cycles = CREATE_CANISTER_CYCLES_FEE + USER_CANISTER_INITIAL_CYCLES_BALANCE;
    match canisters::create::call(init_ok.canister_id, init_ok.canister_wasm.module, wasm_arg, cycles).await {
        Ok(canister_id) => {
            // The canister create/install succeeded.
            // If the confirmed user record has a username then change the stored user from Confirmed to Created
            // otherwise set the user's CanisterCreationStatus to Created.
            let wasm_version = init_ok.canister_wasm.version;
            RUNTIME_STATE.with(|state| commit(caller, canister_id, wasm_version, state.borrow_mut().as_mut().unwrap()));
            Success(canister_id)
        }
        Err(error) => {
            let mut canister_id = None;
            if let CreateCanisterError::InstallFailed((_, id)) = error {
                canister_id = Some(id);
            }
            // The canister create/install failed so set the user's CanisterCreationStatus back to Pending.
            // If the create succeeded but the install failed then set the user_id (aka canister_id)
            // on the user record.
            RUNTIME_STATE.with(|state| rollback(caller, canister_id, state.borrow_mut().as_mut().unwrap()));
            InternalError(format!("{:?}", error))
        }
    }
}

struct InitOk {
    caller: Principal,
    canister_id: Option<CanisterId>,
    canister_wasm: CanisterWasm,
    init_canister_args: InitUserCanisterArgs,
}

fn initialize(runtime_state: &mut RuntimeState) -> Result<InitOk, Response> {
    let caller = runtime_state.env.caller();
    let response;
    if let Some(user) = runtime_state.data.users.get_by_principal(&caller) {
        response = match user {
            User::Unconfirmed(_) => UserUnconfirmed,
            User::Created(_) => UserAlreadyCreated,
            User::Confirmed(confirmed_user) => match confirmed_user.canister_creation_status {
                CanisterCreationStatus::Pending => {
                    let cycles_required = USER_CANISTER_INITIAL_CYCLES_BALANCE + CREATE_CANISTER_CYCLES_FEE;
                    let current_cycles_balance = ic_cdk::api::canister_balance();
                    if current_cycles_balance.saturating_sub(cycles_required) < MIN_CYCLES_BALANCE {
                        return Err(CyclesBalanceTooLow);
                    }

                    let canister_id = confirmed_user.user_id.map(|u| u.into());
                    let user_principal = confirmed_user.principal;
                    let mut user = user.clone();
                    user.set_canister_creation_status(CanisterCreationStatus::InProgress);
                    match runtime_state.data.users.update(user) {
                        UpdateUserResult::Success => {
                            let canister_wasm = runtime_state.data.user_canister_wasm.clone();
                            let init_canister_args = InitUserCanisterArgs {
                                owner: user_principal,
                                group_index_canister_id: runtime_state.data.group_index_canister_id,
                                notification_canister_ids: Vec::new(),
                                wasm_version: canister_wasm.version.clone(),
                            };
                            return Ok(InitOk {
                                caller,
                                canister_id,
                                canister_wasm,
                                init_canister_args,
                            });
                        }
                        _ => InternalError("Failed to update user".to_string()),
                    }
                }
                CanisterCreationStatus::InProgress => CreationInProgress,
                CanisterCreationStatus::Created => UserAlreadyCreated,
            },
        };
    } else {
        response = UserNotFound;
    }

    Err(response)
}

fn commit(caller: Principal, canister_id: CanisterId, wasm_version: Version, runtime_state: &mut RuntimeState) {
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

fn rollback(caller: Principal, canister_id: Option<CanisterId>, runtime_state: &mut RuntimeState) {
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
