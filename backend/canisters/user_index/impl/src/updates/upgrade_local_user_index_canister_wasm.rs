use crate::guards::caller_is_governance_principal;
use crate::{mutate_state, Data, RuntimeState};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use std::collections::HashSet;
use tracing::info;
use types::BuildVersion;
use user_index_canister::upgrade_local_user_index_canister_wasm::{Response::*, *};
use utils::canister::should_perform_upgrade;

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
fn upgrade_local_user_index_canister_wasm(args: Args) -> Response {
    mutate_state(|state| upgrade_local_user_index_canister_wasm_impl(args, state))
}

fn upgrade_local_user_index_canister_wasm_impl(args: Args, state: &mut RuntimeState) -> Response {
    let version = args.wasm.version;

    if !state.data.test_mode && Some(version) <= min_canister_version(&state.data) {
        VersionNotHigher
    } else {
        state.data.canisters_requiring_upgrade.clear();
        if args.use_for_new_canisters.unwrap_or(true) {
            state.data.local_user_index_canister_wasm_for_new_canisters = args.wasm.clone();
        }
        state.data.local_user_index_canister_wasm_for_upgrades = args.wasm;

        let filter = args.filter.unwrap_or_default();
        let include: HashSet<_> = filter.include.into_iter().collect();
        let include_all = include.is_empty();
        let exclude: HashSet<_> = filter.exclude.into_iter().collect();

        for canister_id in state
            .data
            .local_index_map
            .iter()
            .filter(|(_, i)| should_perform_upgrade(i.wasm_version(), version, state.data.test_mode))
            .map(|(c, _)| *c)
            .filter(|c| include_all || include.contains(c))
            .filter(|c| !exclude.contains(c))
        {
            state.data.canisters_requiring_upgrade.enqueue(canister_id, false);
        }
        crate::jobs::upgrade_canisters::start_job_if_required(state);

        state.data.canisters_requiring_upgrade.clear_failed(BuildVersion {
            major: version.major,
            minor: version.minor,
            patch: version.patch.saturating_sub(100),
        });

        let canisters_queued_for_upgrade = state.data.canisters_requiring_upgrade.count_pending();
        info!(%version, canisters_queued_for_upgrade, "Local user index canister wasm upgraded");
        Success
    }
}

fn min_canister_version(data: &Data) -> Option<BuildVersion> {
    data.local_index_map.iter().map(|(_, c)| c.wasm_version()).min()
}
