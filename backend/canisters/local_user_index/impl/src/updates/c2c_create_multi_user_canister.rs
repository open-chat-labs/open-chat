use crate::guards::caller_is_user_index;
use crate::{CHILD_CANISTER_INITIAL_CYCLES_BALANCE, RuntimeState, UserIndexEvent, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::{CREATE_CANISTER_CYCLES_FEE, min_cycles_balance};
use local_user_index_canister::ChildCanisterType;
use local_user_index_canister::c2c_create_multi_user_canister::{Response::*, *};
use oc_error_codes::OCErrorCode;
use rand::RngExt;
use tracing::{error, info};
use types::{BuildVersion, C2CError, CanisterId, CanisterWasm, Cycles, OCResult};
use utils::canister;

#[update(guard = "caller_is_user_index", msgpack = true)]
#[trace]
async fn c2c_create_multi_user_canister(_args: Args) -> Response {
    let prepare_ok = match mutate_state(prepare) {
        Err(error) => return Error(error),
        Ok(ok) => ok,
    };

    let wasm_version = prepare_ok.canister_wasm.version;

    match canister::create_and_install(
        prepare_ok.canister_id,
        None,
        prepare_ok.canister_wasm,
        candid::encode_one(&prepare_ok.init_canister_args).unwrap(),
        prepare_ok.cycles_to_use,
        on_canister_created,
    )
    .await
    {
        Ok(canister_id) => {
            mutate_state(|state| commit(canister_id, wasm_version, state));
            info!(%canister_id, "MultiUser canister created");
            Success(canister_id)
        }
        Err((canister_id, error)) => {
            mutate_state(|state| rollback(canister_id, &error, state));
            Error(error.into())
        }
    }
}

struct PrepareOk {
    canister_id: Option<CanisterId>,
    canister_wasm: CanisterWasm,
    cycles_to_use: Cycles,
    init_canister_args: multi_user_canister::init::Args,
}

fn prepare(state: &mut RuntimeState) -> OCResult<PrepareOk> {
    let canister_wasm = state.data.child_canister_wasms.get(ChildCanisterType::MultiUser).wasm.clone();
    if canister_wasm.module.is_empty() {
        return Err(OCErrorCode::NotInitialized.with_message("MultiUser canister wasm not set"));
    }

    let cycles_to_use = if state.data.canister_pool.is_empty() {
        let cycles_required = CHILD_CANISTER_INITIAL_CYCLES_BALANCE + CREATE_CANISTER_CYCLES_FEE;
        if !utils::cycles::can_spend_cycles(cycles_required, min_cycles_balance(state.data.test_mode)) {
            return Err(OCErrorCode::CyclesBalanceTooLow.into());
        }
        cycles_required
    } else {
        0
    };

    let canister_id = state.data.canister_pool.pop();
    let init_canister_args = multi_user_canister::init::Args {
        user_index_canister_id: state.data.user_index_canister_id,
        local_user_index_canister_id: state.env.canister_id(),
        wasm_version: canister_wasm.version,
        rng_seed: state.env.rng().random(),
        test_mode: state.data.test_mode,
    };

    crate::jobs::topup_canister_pool::start_job_if_required(state, None);

    Ok(PrepareOk {
        canister_id,
        canister_wasm,
        cycles_to_use,
        init_canister_args,
    })
}

fn commit(canister_id: CanisterId, wasm_version: BuildVersion, state: &mut RuntimeState) {
    state.data.local_multi_users.add(canister_id, wasm_version);

    // Tell the UserIndex via the event queue rather than relying on the reply to this call. The
    // queue retries until acked, so the mapping still lands if the reply is dropped, eg. because
    // the UserIndex is upgraded while the call is in flight
    let now = state.env.now();
    state.push_event_to_user_index(UserIndexEvent::MultiUserCanisterCreated(canister_id), now);
}

fn rollback(canister_id: Option<CanisterId>, error: &C2CError, state: &mut RuntimeState) {
    if let Some(canister_id) = canister_id {
        // If this canister is not controlled by the LocalUserIndex then installs into it can
        // never succeed, so drop it from the pool and let the topup job replace it
        if canister::is_invalid_controller_error(error.reject_code(), error.message()) {
            error!(%canister_id, "Dropping canister from pool - LocalUserIndex is not a controller");
            crate::jobs::topup_canister_pool::start_job_if_required(state, None);
        } else {
            state.data.canister_pool.push(canister_id);
        }
    }
}

fn on_canister_created(cycles: Cycles) {
    mutate_state(|state| state.data.total_cycles_spent_on_canisters += cycles);
}
