use crate::updates::set_username::{validate_username, UsernameValidationResult};
use crate::{mutate_state, RuntimeState, USER_CANISTER_INITIAL_CYCLES_BALANCE, USER_LIMIT};
use candid::Principal;
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use types::{CanisterId, CanisterWasm, Cycles, ReferredUserRegistered, UserEvent, UserId, Version};
use user_canister::init::Args as InitUserCanisterArgs;
use user_index_canister::register_user::{Response::*, *};
use utils::canister;
use utils::canister::CreateAndInstallError;
use utils::consts::{CREATE_CANISTER_CYCLES_FEE, MIN_CYCLES_BALANCE};

#[update]
#[trace]
async fn register_user(args: Args) -> Response {
    // Check the challenge
    // Check the username is valid and doesn't already exist then reserve it
    // Extract the wasm module from the runtime state
    let prepare_ok = match mutate_state(|state| prepare(&args, state)) {
        Err(response) => return response,
        Ok(ok) => ok,
    };

    let wasm_arg = candid::encode_one(prepare_ok.init_canister_args).unwrap();
    match canister::create_and_install(
        prepare_ok.canister_id,
        prepare_ok.canister_wasm.module,
        wasm_arg,
        prepare_ok.cycles_to_use,
        on_canister_created,
    )
    .await
    {
        Ok(canister_id) => {
            let user_id = canister_id.into();
            mutate_state(|state| {
                commit(
                    prepare_ok.caller,
                    args.username,
                    prepare_ok.canister_wasm.version,
                    user_id,
                    args.referred_by,
                    state,
                )
            });
            Success(user_id)
        }
        Err(error) => {
            let mut canister_id = None;
            if let CreateAndInstallError::InstallFailed((_, id)) = error {
                canister_id = Some(id);
            }
            mutate_state(|state| rollback(&args.username, canister_id, state));
            InternalError(format!("{error:?}"))
        }
    }
}

struct PrepareOk {
    caller: Principal,
    canister_id: Option<CanisterId>,
    canister_wasm: CanisterWasm,
    cycles_to_use: Cycles,
    init_canister_args: InitUserCanisterArgs,
}

fn prepare(args: &Args, runtime_state: &mut RuntimeState) -> Result<PrepareOk, Response> {
    let caller = runtime_state.env.caller();
    let now = runtime_state.env.now();

    if !runtime_state.data.challenges.check(&args.challenge_attempt, now) {
        return Err(ChallengeFailed);
    }

    if runtime_state.data.users.get_by_principal(&caller).is_some() {
        return Err(AlreadyRegistered);
    }

    if runtime_state.data.users.len() >= USER_LIMIT {
        return Err(UserLimitReached);
    }

    match validate_username(&args.username) {
        UsernameValidationResult::TooShort(min_length) => return Err(UsernameTooShort(min_length)),
        UsernameValidationResult::TooLong(max_length) => return Err(UsernameTooLong(max_length)),
        UsernameValidationResult::Invalid => return Err(UsernameInvalid),
        _ => {}
    };

    let cycles_to_use = if runtime_state.data.canister_pool.is_empty() {
        let cycles_required = USER_CANISTER_INITIAL_CYCLES_BALANCE + CREATE_CANISTER_CYCLES_FEE;
        if !utils::cycles::can_spend_cycles(cycles_required, MIN_CYCLES_BALANCE) {
            return Err(CyclesBalanceTooLow);
        }
        cycles_required
    } else {
        0
    };

    if !runtime_state.data.users.reserve_username(&args.username) {
        return Err(UsernameTaken);
    }

    let canister_id = runtime_state.data.canister_pool.pop();
    let canister_wasm = runtime_state.data.user_canister_wasm.clone();
    let init_canister_args = InitUserCanisterArgs {
        owner: caller,
        group_index_canister_id: runtime_state.data.group_index_canister_id,
        notifications_canister_ids: vec![runtime_state.data.notifications_canister_id],
        ledger_canister_id: runtime_state.data.ledger_canister_id,
        wasm_version: canister_wasm.version,
        username: args.username.clone(),
        test_mode: runtime_state.data.test_mode,
    };

    Ok(PrepareOk {
        caller,
        canister_id,
        canister_wasm,
        cycles_to_use,
        init_canister_args,
    })
}

fn commit(
    caller: Principal,
    username: String,
    wasm_version: Version,
    user_id: UserId,
    referred_by: Option<UserId>,
    runtime_state: &mut RuntimeState,
) {
    let now = runtime_state.env.now();
    runtime_state.data.users.release_username(&username);
    runtime_state
        .data
        .users
        .register(caller, user_id, wasm_version, username.clone(), now, referred_by, false);

    if let Some(referred_by) = referred_by {
        runtime_state.data.user_event_sync_queue.push(
            referred_by,
            UserEvent::ReferredUserRegistered(ReferredUserRegistered { user_id, username }),
        );
    }
}

fn rollback(username: &str, canister_id: Option<CanisterId>, runtime_state: &mut RuntimeState) {
    runtime_state.data.users.release_username(username);
    if let Some(canister_id) = canister_id {
        runtime_state.data.canister_pool.push(canister_id);
    }
}

fn on_canister_created(cycles: Cycles) {
    mutate_state(|state| state.data.total_cycles_spent_on_canisters += cycles);
}
