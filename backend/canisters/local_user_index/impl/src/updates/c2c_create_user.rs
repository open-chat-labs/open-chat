use crate::guards::caller_is_user_index_canister;
use crate::{mutate_state, RuntimeState, USER_CANISTER_INITIAL_CYCLES_BALANCE};
use candid::Principal;
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use local_user_index_canister::c2c_create_user::{Response::*, *};
use types::{CanisterId, CanisterWasm, Cycles, UserId, Version};
use user_canister::init::Args as InitUserCanisterArgs;
use user_canister::{Event as UserEvent, ReferredUserRegistered};
use utils::canister;
use utils::canister::CreateAndInstallError;
use utils::consts::{CREATE_CANISTER_CYCLES_FEE, MIN_CYCLES_BALANCE};

#[update_msgpack(guard = "caller_is_user_index_canister")]
#[trace]
async fn c2c_create_user(args: Args) -> Response {
    let prepare_ok = match mutate_state(|state| prepare(&args, state)) {
        Err(response) => return response,
        Ok(ok) => ok,
    };

    let wasm_version = prepare_ok.canister_wasm.version;

    match canister::create_and_install(
        prepare_ok.canister_id,
        prepare_ok.canister_wasm,
        prepare_ok.init_canister_args,
        prepare_ok.cycles_to_use,
        on_canister_created,
    )
    .await
    {
        Ok(canister_id) => {
            let user_id = canister_id.into();
            mutate_state(|state| commit(args.principal, args.username, args.referred_by, wasm_version, user_id, state));
            Success(user_id)
        }
        Err(error) => {
            let mut canister_id = None;
            if let CreateAndInstallError::InstallFailed(id, ..) = error {
                canister_id = Some(id);
            }
            mutate_state(|state| rollback(canister_id, state));
            InternalError(format!("{error:?}"))
        }
    }
}

struct PrepareOk {
    canister_id: Option<CanisterId>,
    canister_wasm: CanisterWasm,
    cycles_to_use: Cycles,
    init_canister_args: InitUserCanisterArgs,
}

fn prepare(args: &Args, runtime_state: &mut RuntimeState) -> Result<PrepareOk, Response> {
    if runtime_state.data.global_users.get_by_principal(&args.principal).is_some() {
        return Err(AlreadyRegistered);
    }

    let cycles_to_use = if runtime_state.data.canister_pool.is_empty() {
        let cycles_required = USER_CANISTER_INITIAL_CYCLES_BALANCE + CREATE_CANISTER_CYCLES_FEE;
        if !utils::cycles::can_spend_cycles(cycles_required, MIN_CYCLES_BALANCE) {
            return Err(CyclesBalanceTooLow);
        }
        cycles_required
    } else {
        0
    };

    let canister_id = runtime_state.data.canister_pool.pop();
    let canister_wasm = runtime_state.data.user_canister_wasm_for_new_canisters.clone();
    let init_canister_args = InitUserCanisterArgs {
        owner: args.principal,
        group_index_canister_id: runtime_state.data.group_index_canister_id,
        user_index_canister_id: runtime_state.data.user_index_canister_id,
        local_user_index_canister_id: runtime_state.env.canister_id(),
        notifications_canister_id: runtime_state.data.notifications_canister_id,
        wasm_version: canister_wasm.version,
        username: args.username.clone(),
        openchat_bot_messages: args.openchat_bot_messages.clone(),
        test_mode: runtime_state.data.test_mode,
    };

    crate::jobs::topup_canister_pool::start_job_if_required(runtime_state);

    Ok(PrepareOk {
        canister_id,
        canister_wasm,
        cycles_to_use,
        init_canister_args,
    })
}

fn commit(
    user_principal: Principal,
    username: String,
    referred_by: Option<UserId>,
    wasm_version: Version,
    user_id: UserId,
    runtime_state: &mut RuntimeState,
) {
    let now = runtime_state.env.now();
    runtime_state.data.local_users.add(user_id, wasm_version, now);
    runtime_state.data.global_users.add(user_principal, user_id, false);

    if let Some(referred_by) = referred_by {
        if runtime_state.data.local_users.get(&referred_by).is_some() {
            runtime_state.push_event_to_user(
                referred_by,
                UserEvent::ReferredUserRegistered(Box::new(ReferredUserRegistered { user_id, username })),
            );
        }
    }
}

fn rollback(canister_id: Option<CanisterId>, runtime_state: &mut RuntimeState) {
    if let Some(canister_id) = canister_id {
        runtime_state.data.canister_pool.push(canister_id);
    }
}

fn on_canister_created(cycles: Cycles) {
    mutate_state(|state| state.data.total_cycles_spent_on_canisters += cycles);
}
