use crate::guards::caller_is_group_index_canister;
use crate::{mutate_state, RuntimeState, GROUP_CANISTER_INITIAL_CYCLES_BALANCE, MARK_ACTIVE_DURATION};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use group_canister::init::Args as InitGroupCanisterArgs;
use local_group_index_canister::c2c_create_group::{Response::*, *};
use types::{CanisterId, CanisterWasm, ChatId, Cycles, Version};
use utils::canister;
use utils::canister::CreateAndInstallError;
use utils::consts::{CREATE_CANISTER_CYCLES_FEE, MIN_CYCLES_BALANCE};

#[update_msgpack(guard = "caller_is_group_index_canister")]
#[trace]
async fn c2c_create_group(args: Args) -> Response {
    let prepare_ok = match mutate_state(|state| prepare(args, state)) {
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
            let chat_id = canister_id.into();
            mutate_state(|state| commit(chat_id, wasm_version, state));
            Success(SuccessResult { chat_id })
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
    init_canister_args: InitGroupCanisterArgs,
}

fn prepare(args: Args, runtime_state: &mut RuntimeState) -> Result<PrepareOk, Response> {
    let cycles_to_use = if runtime_state.data.canister_pool.is_empty() {
        let cycles_required = GROUP_CANISTER_INITIAL_CYCLES_BALANCE + CREATE_CANISTER_CYCLES_FEE;
        if !utils::cycles::can_spend_cycles(cycles_required, MIN_CYCLES_BALANCE) {
            return Err(CyclesBalanceTooLow);
        }
        cycles_required
    } else {
        0
    };

    let canister_id = runtime_state.data.canister_pool.pop();
    let canister_wasm = runtime_state.data.group_canister_wasm_for_new_canisters.clone();
    let init_canister_args = group_canister::init::Args {
        is_public: args.is_public,
        name: args.name,
        description: args.description,
        rules: args.rules,
        subtype: args.subtype,
        // History is always visible on public groups
        history_visible_to_new_joiners: args.is_public || args.history_visible_to_new_joiners,
        permissions: args.permissions,
        created_by_principal: args.created_by_user_principal,
        created_by_user_id: args.created_by_user_id,
        events_ttl: args.events_ttl,
        mark_active_duration: MARK_ACTIVE_DURATION,
        group_index_canister_id: runtime_state.data.group_index_canister_id,
        local_group_index_canister_id: runtime_state.env.canister_id(),
        user_index_canister_id: runtime_state.data.user_index_canister_id,
        local_user_index_canister_id: runtime_state.data.local_user_index_canister_id,
        notifications_canister_id: runtime_state.data.notifications_canister_id,
        proposals_bot_user_id: runtime_state.data.proposals_bot_user_id,
        avatar: args.avatar,
        gate: args.gate,
        wasm_version: canister_wasm.version,
        test_mode: runtime_state.data.test_mode,
    };

    Ok(PrepareOk {
        canister_id,
        canister_wasm,
        cycles_to_use,
        init_canister_args,
    })
}

fn commit(chat_id: ChatId, wasm_version: Version, runtime_state: &mut RuntimeState) {
    runtime_state.data.local_groups.add(chat_id, wasm_version);
}

fn rollback(canister_id: Option<CanisterId>, runtime_state: &mut RuntimeState) {
    if let Some(canister_id) = canister_id {
        runtime_state.data.canister_pool.push(canister_id);
    }
}

fn on_canister_created(cycles: Cycles) {
    mutate_state(|state| state.data.total_cycles_spent_on_canisters += cycles);
}
