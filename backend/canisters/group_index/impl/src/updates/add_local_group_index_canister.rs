use crate::guards::caller_is_controller;
use crate::{mutate_state, read_state, RuntimeState};
use canister_tracing_macros::trace;
use group_index_canister::add_local_group_index_canister::{Response::*, *};
use ic_cdk_macros::update;
use local_group_index_canister::c2c_add_initial_groups::Group;
use tracing::{error, info};
use types::{CanisterId, CanisterWasm, Version};
use utils::canister::install;

#[update(guard = "caller_is_controller")]
#[trace]
async fn add_local_group_index_canister(args: Args) -> Response {
    match read_state(|state| prepare(args.canister_id, state)) {
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

                    if read_state(|state| state.data.local_index_map.len() == 1) {
                        bootstrap_first_local_group_index(args.canister_id).await;
                    }

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

fn prepare(canister_id: CanisterId, runtime_state: &RuntimeState) -> Result<PrepareResult, Response> {
    if !runtime_state.data.local_index_map.contains_key(&canister_id) {
        Ok(PrepareResult {
            canister_wasm: runtime_state.data.local_group_index_canister_wasm.clone(),
            init_args: local_group_index_canister::init::Args {
                group_canister_wasm: runtime_state.data.group_canister_wasm.clone(),
                wasm_version: runtime_state.data.local_group_index_canister_wasm.version,
                user_index_canister_id: runtime_state.data.user_index_canister_id,
                group_index_canister_id: runtime_state.env.canister_id(),
                notifications_canister_ids: vec![runtime_state.data.notifications_canister_id],
                cycles_dispenser_canister_id: runtime_state.data.cycles_dispenser_canister_id,
                ledger_canister_id: runtime_state.data.ledger_canister_id,
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

async fn bootstrap_first_local_group_index(canister_id: CanisterId) {
    let groups: Vec<_> = read_state(|state| {
        let private_groups = state.data.private_groups.iter().map(|g| Group {
            chat_id: g.id(),
            wasm_version: g.wasm_version(),
        });
        let public_groups = state.data.public_groups.iter().map(|g| Group {
            chat_id: g.id(),
            wasm_version: g.wasm_version(),
        });
        private_groups.chain(public_groups).collect()
    });

    let group_ids: Vec<_> = groups.iter().map(|g| g.chat_id).collect();

    match local_group_index_canister_c2c_client::c2c_add_initial_groups(
        canister_id,
        &local_group_index_canister::c2c_add_initial_groups::Args { groups },
    )
    .await
    {
        Ok(_) => {
            mutate_state(|state| {
                for chat_id in group_ids {
                    state.data.local_index_map.add_group(canister_id, chat_id);
                }
            });
            info!(canister_id = %canister_id, "groups added to first local group index canister");
        }
        Err(error) => {
            error!(?error, "Error calling c2c_notify_group_index_events");
        }
    }
}
