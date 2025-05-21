use crate::guards::caller_is_registry_canister;
use crate::updates::upgrade_community_canister_wasm::upgrade_community_wasm_in_local_index;
use crate::updates::upgrade_group_canister_wasm::upgrade_group_wasm_in_local_index;
use crate::{RuntimeState, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_index_canister::ChildCanisterType;
use group_index_canister::add_local_group_index_canister::{Response::*, *};
use tracing::info;
use types::{CanisterId, CanisterWasm, Hash};

#[update(guard = "caller_is_registry_canister", msgpack = true)]
#[trace]
async fn add_local_group_index_canister(args: Args) -> Response {
    match read_state(|state| prepare(&args, state)) {
        Ok(result) => {
            if let Err(error) = upgrade_group_wasm_in_local_index(
                args.local_user_index_canister_id,
                &result.group_canister_wasm,
                result.group_canister_wasm_hash,
                None,
            )
            .await
            {
                InternalError(format!("Failed to install group canister wasm: {error:?}"))
            } else if let Err(error) = upgrade_community_wasm_in_local_index(
                args.local_user_index_canister_id,
                &result.community_canister_wasm,
                result.community_canister_wasm_hash,
                None,
            )
            .await
            {
                InternalError(format!("Failed to install community canister wasm: {error:?}"))
            } else {
                let response = mutate_state(|state| commit(args.local_user_index_canister_id, state));
                info!(canister_id = %args.local_user_index_canister_id, "local index canister added");
                response
            }
        }
        Err(response) => response,
    }
}

struct PrepareResult {
    group_canister_wasm: CanisterWasm,
    group_canister_wasm_hash: Hash,
    community_canister_wasm: CanisterWasm,
    community_canister_wasm_hash: Hash,
}

fn prepare(args: &Args, state: &RuntimeState) -> Result<PrepareResult, Response> {
    if !state.data.local_index_map.contains_key(&args.canister_id) {
        let group_canister_wasm = state.data.child_canister_wasms.get(ChildCanisterType::Group);
        let community_canister_wasm = state.data.child_canister_wasms.get(ChildCanisterType::Community);

        Ok(PrepareResult {
            group_canister_wasm: group_canister_wasm.wasm.clone(),
            group_canister_wasm_hash: group_canister_wasm.wasm_hash,
            community_canister_wasm: community_canister_wasm.wasm.clone(),
            community_canister_wasm_hash: community_canister_wasm.wasm_hash,
        })
    } else {
        Err(AlreadyAdded)
    }
}

fn commit(local_user_index_canister_id: CanisterId, state: &mut RuntimeState) -> Response {
    if state.data.local_index_map.add_index(local_user_index_canister_id) {
        Success
    } else {
        AlreadyAdded
    }
}
