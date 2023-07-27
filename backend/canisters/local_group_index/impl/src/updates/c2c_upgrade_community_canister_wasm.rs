use crate::guards::caller_is_group_index_canister;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use local_group_index_canister::c2c_upgrade_community_canister_wasm::{Response::*, *};
use std::collections::HashSet;
use tracing::info;
use types::CanisterId;

#[update_msgpack(guard = "caller_is_group_index_canister")]
#[trace]
fn c2c_upgrade_community_canister_wasm(args: Args) -> Response {
    mutate_state(|state| c2c_upgrade_community_canister_wasm_impl(args, state))
}

fn c2c_upgrade_community_canister_wasm_impl(args: Args, state: &mut RuntimeState) -> Response {
    let version = args.wasm.version;

    if !state.data.test_mode && version < state.data.community_canister_wasm_for_new_canisters.version {
        VersionNotHigher
    } else {
        state.data.communities_requiring_upgrade.clear();
        if args.use_for_new_canisters.unwrap_or(true) {
            state.data.community_canister_wasm_for_new_canisters = args.wasm.clone();
        }
        state.data.community_canister_wasm_for_upgrades = args.wasm;

        let filter = args.filter.unwrap_or_default();
        let include: HashSet<_> = filter.include.into_iter().collect();
        let include_all = include.is_empty();
        let exclude: HashSet<_> = filter.exclude.into_iter().collect();

        for canister_id in state
            .data
            .local_communities
            .iter()
            .filter(|(_, community)| community.wasm_version != version)
            .map(|(community_id, _)| CanisterId::from(*community_id))
            .filter(|c| include_all || include.contains(c))
            .filter(|c| !exclude.contains(c))
        {
            state.data.communities_requiring_upgrade.enqueue(canister_id, false);
        }

        let canisters_queued_for_upgrade = state.data.communities_requiring_upgrade.count_pending();
        info!(%version, canisters_queued_for_upgrade, "Community canister wasm upgraded");
        Success
    }
}
