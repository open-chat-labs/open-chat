use crate::guards::caller_is_governance_principal;
use crate::{mutate_state, read_state, RuntimeState};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use group_index_canister::add_local_group_index_canister::{Response::*, *};
use ic_cdk::api::management_canister::main::CanisterInstallMode;
use tracing::info;
use types::{BuildVersion, CanisterId, CanisterWasm};
use utils::canister::{install, CanisterToInstall, WasmToInstall};

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
async fn add_local_group_index_canister(args: Args) -> Response {
    match read_state(|state| prepare(&args, state)) {
        Ok(result) => {
            let wasm_version = result.canister_wasm.version;
            match install(CanisterToInstall {
                canister_id: args.canister_id,
                current_wasm_version: BuildVersion::default(),
                new_wasm_version: result.canister_wasm.version,
                new_wasm: WasmToInstall::Default(result.canister_wasm.module),
                deposit_cycles_if_needed: true,
                args: result.init_args,
                mode: CanisterInstallMode::Install,
                stop_start_canister: false,
            })
            .await
            {
                Ok(_) => {
                    let response = mutate_state(|state| commit(args.canister_id, wasm_version, state));
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

fn prepare(args: &Args, state: &RuntimeState) -> Result<PrepareResult, Response> {
    if !state.data.local_index_map.contains_key(&args.canister_id) {
        Ok(PrepareResult {
            canister_wasm: state.data.local_group_index_canister_wasm_for_new_canisters.clone(),
            init_args: local_group_index_canister::init::Args {
                group_canister_wasm: state.data.group_canister_wasm.clone(),
                community_canister_wasm: state.data.community_canister_wasm.clone(),
                wasm_version: state.data.local_group_index_canister_wasm_for_new_canisters.version,
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
