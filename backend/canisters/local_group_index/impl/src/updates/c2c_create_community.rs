use crate::guards::caller_is_group_index_canister;
use crate::{mutate_state, RuntimeState, COMMUNITY_CANISTER_INITIAL_CYCLES_BALANCE, MARK_ACTIVE_DURATION};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use community_canister::init::Args as InitCommunityCanisterArgs;
use local_group_index_canister::c2c_create_community::{Response::*, *};
use types::{CanisterId, CanisterWasm, CommunityId, Cycles, Version};
use utils::canister;
use utils::canister::CreateAndInstallError;
use utils::consts::{CREATE_CANISTER_CYCLES_FEE, MIN_CYCLES_BALANCE};

#[update_msgpack(guard = "caller_is_group_index_canister")]
#[trace]
async fn c2c_create_community(args: Args) -> Response {
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
            let community_id = canister_id.into();
            mutate_state(|state| commit(community_id, wasm_version, state));
            Success(SuccessResult { community_id })
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
    init_canister_args: InitCommunityCanisterArgs,
}

fn prepare(args: Args, state: &mut RuntimeState) -> Result<PrepareOk, Response> {
    let cycles_to_use = if state.data.canister_pool.is_empty() {
        let cycles_required = COMMUNITY_CANISTER_INITIAL_CYCLES_BALANCE + CREATE_CANISTER_CYCLES_FEE;
        if !utils::cycles::can_spend_cycles(cycles_required, MIN_CYCLES_BALANCE) {
            return Err(InternalError("Cycles balance too low".to_string()));
        }
        cycles_required
    } else {
        0
    };

    let canister_id = state.data.canister_pool.pop();
    let canister_wasm = state.data.community_canister_wasm_for_new_canisters.clone();
    let init_canister_args = community_canister::init::Args {
        is_public: args.is_public,
        name: args.name,
        description: args.description,
        rules: args.rules,
        permissions: args.permissions.unwrap_or_default(),
        created_by_principal: args.created_by_user_principal,
        created_by_user_id: args.created_by_user_id,
        mark_active_duration: MARK_ACTIVE_DURATION,
        group_index_canister_id: state.data.group_index_canister_id,
        local_group_index_canister_id: state.env.canister_id(),
        user_index_canister_id: state.data.user_index_canister_id,
        local_user_index_canister_id: state.data.local_user_index_canister_id,
        notifications_canister_id: state.data.notifications_canister_id,
        proposals_bot_user_id: state.data.proposals_bot_user_id,
        avatar: args.avatar,
        banner: args.banner,
        gate: args.gate,
        default_channels: args.default_channels,
        source_group: args.source_group,
        wasm_version: canister_wasm.version,
        test_mode: state.data.test_mode,
    };

    Ok(PrepareOk {
        canister_id,
        canister_wasm,
        cycles_to_use,
        init_canister_args,
    })
}

fn commit(community_id: CommunityId, wasm_version: Version, state: &mut RuntimeState) {
    state.data.local_communities.add(community_id, wasm_version);
}

fn rollback(canister_id: Option<CanisterId>, state: &mut RuntimeState) {
    if let Some(canister_id) = canister_id {
        state.data.canister_pool.push(canister_id);
    }
}

fn on_canister_created(cycles: Cycles) {
    mutate_state(|state| state.data.total_cycles_spent_on_canisters += cycles);
}
