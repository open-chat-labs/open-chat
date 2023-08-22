use crate::guards::caller_is_user_index_canister;
use crate::{mutate_state, Data, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use local_user_index_canister::c2c_upgrade_user_canister_wasm::{Response::*, *};
use std::collections::HashSet;
use tracing::info;
use types::{BuildVersion, CanisterId};
use utils::canister::should_perform_upgrade;

#[update_msgpack(guard = "caller_is_user_index_canister")]
#[trace]
fn c2c_upgrade_user_canister_wasm(args: Args) -> Response {
    mutate_state(|state| c2c_upgrade_user_canister_wasm_impl(args, state))
}

fn c2c_upgrade_user_canister_wasm_impl(args: Args, state: &mut RuntimeState) -> Response {
    let version = args.wasm.version;
    let use_for_new_canisters = args.use_for_new_canisters.unwrap_or(true);

    if !is_version_valid(version, use_for_new_canisters, &state.data) {
        VersionNotHigher
    } else {
        state.data.canisters_requiring_upgrade.clear();
        if use_for_new_canisters {
            state.data.user_canister_wasm_for_new_canisters = args.wasm.clone();
        }
        state.data.user_canister_wasm_for_upgrades = args.wasm;

        let filter = args.filter.unwrap_or_default();
        let include: HashSet<_> = filter.include.into_iter().collect();
        let include_all = include.is_empty();
        let exclude: HashSet<_> = filter.exclude.into_iter().collect();

        for canister_id in state
            .data
            .local_users
            .iter()
            .filter(|(user_id, user)| {
                should_perform_upgrade(user.wasm_version, version, state.data.test_mode)
                    && !state.data.global_users.is_bot(user_id)
            })
            .map(|(user_id, _)| CanisterId::from(*user_id))
            .filter(|c| include_all || include.contains(c))
            .filter(|c| !exclude.contains(c))
        {
            state.data.canisters_requiring_upgrade.enqueue(canister_id, false);
        }
        crate::jobs::upgrade_canisters::start_job_if_required(state);

        let canisters_queued_for_upgrade = state.data.canisters_requiring_upgrade.count_pending();
        info!(%version, canisters_queued_for_upgrade, "User canister wasm upgraded");
        Success
    }
}

fn is_version_valid(version: BuildVersion, use_for_new_canisters: bool, data: &Data) -> bool {
    if data.test_mode {
        true
    } else if use_for_new_canisters && version < data.user_canister_wasm_for_new_canisters.version {
        false
    } else if version < min_canister_version(data).unwrap_or_default() {
        false
    } else {
        true
    }
}

fn min_canister_version(data: &Data) -> Option<BuildVersion> {
    data.local_users.iter().map(|(_, u)| u.wasm_version).min()
}
