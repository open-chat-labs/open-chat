use crate::guards::caller_is_governance_principal;
use crate::{mutate_state, read_state, RuntimeState};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use ic_cdk::api::management_canister::main::CanisterInstallMode;
use local_user_index_canister::{Event, UserRegistered};
use tracing::info;
use types::{BuildVersion, CanisterId, CanisterWasm};
use user_index_canister::add_local_user_index_canister::{Response::*, *};
use utils::canister::{install, CanisterToInstall};

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
async fn add_local_user_index_canister(args: Args) -> Response {
    match read_state(|state| prepare(&args, state)) {
        Ok(result) => {
            let wasm_version = result.canister_wasm.version;
            match install(CanisterToInstall {
                canister_id: args.canister_id,
                current_wasm_version: BuildVersion::default(),
                new_wasm: result.canister_wasm,
                deposit_cycles_if_needed: true,
                args: result.init_args,
                mode: CanisterInstallMode::Install,
                stop_start_canister: false,
            })
            .await
            {
                Ok(_) => {
                    let response = mutate_state(|state| commit(args.canister_id, wasm_version, state));
                    info!(canister_id = %args.canister_id, "local user index canister added");
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
    init_args: local_user_index_canister::init::Args,
}

fn prepare(args: &Args, state: &RuntimeState) -> Result<PrepareResult, Response> {
    if !state.data.local_index_map.contains_key(&args.canister_id) {
        Ok(PrepareResult {
            canister_wasm: state.data.local_user_index_canister_wasm_for_new_canisters.clone(),
            init_args: local_user_index_canister::init::Args {
                user_canister_wasm: state.data.user_canister_wasm.clone(),
                wasm_version: state.data.local_user_index_canister_wasm_for_new_canisters.version,
                user_index_canister_id: state.env.canister_id(),
                group_index_canister_id: state.data.group_index_canister_id,
                notifications_canister_id: args.notifications_canister_id,
                cycles_dispenser_canister_id: state.data.cycles_dispenser_canister_id,
                internet_identity_canister_id: state.data.internet_identity_canister_id,
                test_mode: state.data.test_mode,
            },
        })
    } else {
        Err(AlreadyAdded)
    }
}

fn commit(canister_id: CanisterId, wasm_version: BuildVersion, state: &mut RuntimeState) -> Response {
    if state.data.local_index_map.add_index(canister_id, wasm_version) {
        // We need to initialize the new local user index with all of the existing users
        for user in state.data.users.iter() {
            state.data.user_index_event_sync_queue.push(
                canister_id,
                Event::UserRegistered(UserRegistered {
                    user_id: user.user_id,
                    user_principal: user.principal,
                    username: user.username.clone(),
                    is_bot: user.is_bot,
                    referred_by: user.referred_by,
                }),
            )
        }
        crate::jobs::sync_events_to_local_user_index_canisters::start_job_if_required(state);

        Success
    } else {
        AlreadyAdded
    }
}
