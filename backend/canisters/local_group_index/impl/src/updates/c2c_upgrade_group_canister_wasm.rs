use crate::guards::caller_is_group_index_canister;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use local_group_index_canister::c2c_upgrade_group_canister_wasm::{Response::*, *};
use std::collections::HashSet;
use tracing::info;

#[update_msgpack(guard = "caller_is_group_index_canister")]
#[trace]
fn c2c_upgrade_group_canister_wasm(args: Args) -> Response {
    mutate_state(|state| c2c_upgrade_group_canister_wasm_impl(args, state))
}

fn c2c_upgrade_group_canister_wasm_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let version = args.wasm.version;

    if !runtime_state.data.test_mode && version < runtime_state.data.group_canister_wasm_for_new_canisters.version {
        VersionNotHigher
    } else {
        runtime_state.data.canisters_requiring_upgrade.clear();
        if args.use_for_new_canisters.unwrap_or(true) {
            runtime_state.data.group_canister_wasm_for_new_canisters = args.wasm.clone();
        }
        runtime_state.data.group_canister_wasm_for_upgrades = args.wasm;

        let filter = args.filter.unwrap_or_default();
        let include: HashSet<_> = filter.include.into_iter().collect();
        let include_all = include.is_empty();
        let exclude: HashSet<_> = filter.exclude.into_iter().collect();

        for chat_id in runtime_state
            .data
            .local_groups
            .iter()
            .filter(|(_, group)| group.wasm_version != version)
            .filter(|(&user_id, _)| include_all || include.contains(&user_id.into()))
            .filter(|(&user_id, _)| !exclude.contains(&user_id.into()))
            .map(|(chat_id, _)| *chat_id)
        {
            runtime_state.data.canisters_requiring_upgrade.enqueue(chat_id.into())
        }

        let canisters_queued_for_upgrade = runtime_state.data.canisters_requiring_upgrade.count_pending();
        info!(%version, canisters_queued_for_upgrade, "Group canister wasm upgraded");
        Success
    }
}
