use crate::guards::caller_is_registry_canister;
use crate::updates::upgrade_community_canister_wasm::upgrade_community_wasm_in_local_group_index;
use crate::updates::upgrade_group_canister_wasm::upgrade_group_wasm_in_local_group_index;
use crate::{mutate_state, read_state, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_index_canister::add_local_group_index_canister::{Response::*, *};
use group_index_canister::ChildCanisterType;
use ic_cdk::api::management_canister::main::{canister_info, CanisterInfoRequest};
use tracing::info;
use types::{BuildVersion, CanisterId, CanisterWasm, Hash};
use utils::canister::{install_basic, set_controllers};

#[update(guard = "caller_is_registry_canister", msgpack = true)]
#[trace]
async fn add_local_group_index_canister(args: Args) -> Response {
    match read_state(|state| prepare(&args, state)) {
        Ok(result) => {
            let wasm_version = result.canister_wasm.version;

            let canister_info = match canister_info(CanisterInfoRequest {
                canister_id: args.canister_id,
                num_requested_changes: None,
            })
            .await
            {
                Ok((info,)) => info,
                Err(error) => return InternalError(format!("Failed to get canister info: {error:?}")),
            };

            let controllers = vec![result.this_canister_id];
            if canister_info.controllers != controllers {
                if let Err(error) = set_controllers(args.canister_id, controllers).await {
                    return InternalError(format!("Failed to set controller: {error:?}"));
                }
                info!("Updated controllers");
            }

            if canister_info.module_hash != Some(result.canister_wasm_hash.to_vec()) {
                if let Err(error) = install_basic(args.canister_id, result.canister_wasm, result.init_args).await {
                    return InternalError(format!("Failed to install canister: {error:?}"));
                }
                info!("Installed wasm");
            }

            if let Err(error) = upgrade_group_wasm_in_local_group_index(
                args.canister_id,
                &result.group_canister_wasm,
                result.group_canister_wasm_hash,
                None,
            )
            .await
            {
                InternalError(format!("Failed to install group canister wasm: {error:?}"))
            } else if let Err(error) = upgrade_community_wasm_in_local_group_index(
                args.canister_id,
                &result.community_canister_wasm,
                result.community_canister_wasm_hash,
                None,
            )
            .await
            {
                InternalError(format!("Failed to install community canister wasm: {error:?}"))
            } else {
                let response = mutate_state(|state| commit(args.canister_id, wasm_version, state));
                info!(canister_id = %args.canister_id, "local group index canister added");
                response
            }
        }
        Err(response) => response,
    }
}

struct PrepareResult {
    this_canister_id: CanisterId,
    canister_wasm: CanisterWasm,
    canister_wasm_hash: Hash,
    group_canister_wasm: CanisterWasm,
    group_canister_wasm_hash: Hash,
    community_canister_wasm: CanisterWasm,
    community_canister_wasm_hash: Hash,
    init_args: local_group_index_canister::init::Args,
}

fn prepare(args: &Args, state: &RuntimeState) -> Result<PrepareResult, Response> {
    if !state.data.local_index_map.contains_key(&args.canister_id) {
        let canister_wasm = state.data.child_canister_wasms.get(ChildCanisterType::LocalGroupIndex);

        let group_canister_wasm = state.data.child_canister_wasms.get(ChildCanisterType::Group);
        let community_canister_wasm = state.data.child_canister_wasms.get(ChildCanisterType::Community);

        Ok(PrepareResult {
            this_canister_id: state.env.canister_id(),
            canister_wasm: canister_wasm.wasm.clone(),
            canister_wasm_hash: canister_wasm.wasm_hash,
            group_canister_wasm: group_canister_wasm.wasm.clone(),
            group_canister_wasm_hash: group_canister_wasm.wasm_hash,
            community_canister_wasm: community_canister_wasm.wasm.clone(),
            community_canister_wasm_hash: community_canister_wasm.wasm_hash,
            init_args: local_group_index_canister::init::Args {
                wasm_version: canister_wasm.wasm.version,
                user_index_canister_id: state.data.user_index_canister_id,
                local_user_index_canister_id: args.local_user_index_canister_id,
                group_index_canister_id: state.env.canister_id(),
                notifications_canister_id: args.notifications_canister_id,
                cycles_dispenser_canister_id: state.data.cycles_dispenser_canister_id,
                proposals_bot_user_id: state.data.proposals_bot_user_id,
                escrow_canister_id: state.data.escrow_canister_id,
                event_relay_canister_id: state.data.event_relay_canister_id,
                internet_identity_canister_id: state.data.internet_identity_canister_id,
                video_call_operators: state.data.video_call_operators.clone(),
                ic_root_key: state.data.ic_root_key.clone(),
                test_mode: state.data.test_mode,
            },
        })
    } else {
        Err(AlreadyAdded)
    }
}

fn commit(canister_id: CanisterId, wasm_version: BuildVersion, state: &mut RuntimeState) -> Response {
    if state.data.local_index_map.add_index(canister_id, wasm_version) {
        Success
    } else {
        AlreadyAdded
    }
}
