use crate::guards::caller_is_controller;
use crate::{mutate_state, read_state, RuntimeState};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use group_index_canister::add_local_group_index_canister::{Response::*, *};
use tracing::info;
use types::{CanisterId, CanisterWasm, Version};
use utils::canister::install;

#[proposal(guard = "caller_is_controller")]
#[trace]
async fn add_local_group_index_canister(args: Args) -> Response {
    match read_state(|state| prepare(&args, state)) {
        Ok(result) => {
            match install(
                args.canister_id,
                result.canister_wasm.module,
                candid::encode_one(result.init_args).unwrap(),
            )
            .await
            {
                Ok(_) => {
                    let response = mutate_state(|state| commit(args.canister_id, result.canister_wasm.version, state));
                    info!(canister_id = %args.canister_id, "local group index canister added");
                    response
                }
                Err(error) => InternalError(format!("{error:?}")),
            }
        }
        Err(response) => response,
    }
}

struct PrepareResult {
    canister_wasm: CanisterWasm,
    init_args: local_group_index_canister::init::Args,
}

fn prepare(args: &Args, runtime_state: &RuntimeState) -> Result<PrepareResult, Response> {
    if !runtime_state.data.local_index_map.contains_key(&args.canister_id) {
        Ok(PrepareResult {
            canister_wasm: runtime_state.data.local_group_index_canister_wasm.clone(),
            init_args: local_group_index_canister::init::Args {
                group_canister_wasm: runtime_state.data.group_canister_wasm.clone(),
                wasm_version: runtime_state.data.local_group_index_canister_wasm.version,
                user_index_canister_id: runtime_state.data.user_index_canister_id,
                local_user_index_canister_id: args.local_user_index_canister_id,
                group_index_canister_id: runtime_state.env.canister_id(),
                notifications_canister_id: args.notifications_canister_id,
                cycles_dispenser_canister_id: runtime_state.data.cycles_dispenser_canister_id,
                ledger_canister_id: runtime_state.data.ledger_canister_id,
                proposals_bot_user_id: runtime_state.data.proposals_bot_user_id,
                test_mode: runtime_state.data.test_mode,
            },
        })
    } else {
        Err(AlreadyAdded)
    }
}

fn commit(canister_id: CanisterId, wasm_version: Version, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.local_index_map.add_index(canister_id, wasm_version) {
        Success
    } else {
        AlreadyAdded
    }
}
