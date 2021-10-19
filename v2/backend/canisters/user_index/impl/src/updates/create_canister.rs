use crate::model::user::{CreatedUser, User};
use crate::model::user_map::UpdateUserResult;
use crate::{RuntimeState, MIN_CYCLES_BALANCE, RUNTIME_STATE, USER_CANISTER_INITIAL_CYCLES_BALANCE};
use candid::Principal;
use ic_cdk_macros::update;
use tracing::instrument;
use types::{CanisterCreationStatus, CanisterCreationStatusInternal, CanisterId, CanisterWasm, Cycles, CyclesTopUp, Version};
use user_canister::init::Args as InitUserCanisterArgs;
use user_index_canister::create_canister::{Response::*, *};
use utils::canister;
use utils::canister::CreateAndInstallError;
use utils::consts::CREATE_CANISTER_CYCLES_FEE;

#[update]
#[instrument(level = "trace")]
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
    let cycles_to_use = init_ok.cycles_to_use;
    match canister::create_and_install(init_ok.canister_id, init_ok.canister_wasm.module, wasm_arg, cycles_to_use).await {
        Ok(canister_id) => {
            // The canister create/install succeeded.
            // If the confirmed user record has a username then change the stored user from Confirmed to Created
            // otherwise set the user's CanisterCreationStatus to Created.
            let wasm_version = init_ok.canister_wasm.version;
            let canister_created = init_ok.canister_id.is_none();
            RUNTIME_STATE.with(|state| {
                commit(
                    caller,
                    canister_id,
                    wasm_version,
                    cycles_to_use,
                    canister_created,
                    state.borrow_mut().as_mut().unwrap(),
                )
            });
            Success(canister_id)
        }
        Err(error) => {
            let mut canister_id = None;
            if let CreateAndInstallError::InstallFailed((_, id)) = error {
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
    cycles_to_use: Cycles,
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
                CanisterCreationStatusInternal::Pending(canister_id) => {
                    let create_new_canister = canister_id.is_none() && runtime_state.data.canister_pool.is_empty();
                    let cycles_to_use = if create_new_canister {
                        let cycles_required = USER_CANISTER_INITIAL_CYCLES_BALANCE + CREATE_CANISTER_CYCLES_FEE;
                        if !cycles_utils::can_spend_cycles(cycles_required, MIN_CYCLES_BALANCE) {
                            return Err(CyclesBalanceTooLow);
                        }
                        cycles_required
                    } else {
                        0
                    };

                    let user_principal = confirmed_user.principal;
                    let mut user = user.clone();
                    user.set_canister_creation_status(CanisterCreationStatusInternal::InProgress);
                    match runtime_state.data.users.update(user) {
                        UpdateUserResult::Success => {
                            let canister_id = canister_id.or_else(|| runtime_state.data.canister_pool.pop());
                            let canister_wasm = runtime_state.data.user_canister_wasm.clone();
                            let init_canister_args = InitUserCanisterArgs {
                                owner: user_principal,
                                group_index_canister_id: runtime_state.data.group_index_canister_id,
                                notification_canister_ids: Vec::new(),
                                wasm_version: canister_wasm.version,
                                test_mode: runtime_state.data.test_mode,
                            };

                            return Ok(InitOk {
                                caller,
                                canister_id,
                                canister_wasm,
                                cycles_to_use,
                                init_canister_args,
                            });
                        }
                        _ => InternalError("Failed to update user".to_string()),
                    }
                }
                CanisterCreationStatusInternal::InProgress => CreationInProgress,
                CanisterCreationStatusInternal::Created(..) => UserAlreadyCreated,
            },
        };
    } else {
        response = UserNotFound;
    }

    Err(response)
}

fn commit(
    caller: Principal,
    canister_id: CanisterId,
    wasm_version: Version,
    cycles: Cycles,
    canister_created: bool,
    runtime_state: &mut RuntimeState,
) {
    let now = runtime_state.env.now();
    if let Some(user) = runtime_state.data.users.get_by_principal(&caller) {
        if let User::Confirmed(confirmed_user) = user {
            if let CanisterCreationStatus::InProgress = confirmed_user.canister_creation_status.into() {
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
                            cycle_top_ups: vec![CyclesTopUp {
                                amount: cycles,
                                date: now,
                            }],
                            avatar_id: None,
                        };
                        User::Created(created_user)
                    }
                    None => {
                        let mut user = user.clone();
                        user.set_canister_creation_status(CanisterCreationStatusInternal::Created(
                            canister_id,
                            wasm_version,
                            cycles,
                        ));
                        user
                    }
                };
                runtime_state.data.users.update(user_to_update);
            }
        }
    }

    if canister_created {
        runtime_state.data.total_cycles_spent_on_canisters += cycles;
    }
}

fn rollback(caller: Principal, canister_id: Option<CanisterId>, runtime_state: &mut RuntimeState) {
    if let Some(user) = runtime_state.data.users.get_by_principal(&caller) {
        if let User::Confirmed(confirmed_user) = user {
            if matches!(
                confirmed_user.canister_creation_status,
                CanisterCreationStatusInternal::InProgress
            ) {
                let mut user = user.clone();
                user.set_canister_creation_status(CanisterCreationStatusInternal::Pending(canister_id));
                runtime_state.data.users.update(user);
                return;
            }
        }
    }

    if let Some(canister_id) = canister_id {
        runtime_state.data.canister_pool.push(canister_id);
    }
}
