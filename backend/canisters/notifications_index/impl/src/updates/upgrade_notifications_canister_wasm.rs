use crate::guards::caller_is_governance_principal;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use notifications_index_canister::upgrade_notifications_canister_wasm::{Response::*, *};
use std::collections::HashSet;
use tracing::info;

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
fn upgrade_notifications_canister_wasm(args: Args) -> Response {
    mutate_state(|state| upgrade_notifications_canister_wasm_impl(args, state))
}

fn upgrade_notifications_canister_wasm_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let version = args.wasm.version;

    if !runtime_state.data.test_mode && version < runtime_state.data.notifications_canister_wasm_for_new_canisters.version {
        VersionNotHigher
    } else {
        runtime_state.data.canisters_requiring_upgrade.clear();
        if args.use_for_new_canisters.unwrap_or(true) {
            runtime_state.data.notifications_canister_wasm_for_new_canisters = args.wasm.clone();
        }
        runtime_state.data.notifications_canister_wasm_for_upgrades = args.wasm;

        let filter = args.filter.unwrap_or_default();
        let include: HashSet<_> = filter.include.into_iter().collect();
        let include_all = include.is_empty();
        let exclude: HashSet<_> = filter.exclude.into_iter().collect();

        for canister_id in runtime_state
            .data
            .notifications_canisters
            .iter()
            .filter(|(_, n)| n.wasm_version() != version)
            .map(|(c, _)| *c)
            .filter(|c| include_all || include.contains(c))
            .filter(|c| !exclude.contains(c))
        {
            runtime_state.data.canisters_requiring_upgrade.enqueue(canister_id);
        }

        crate::jobs::upgrade_canisters::start_job_if_required(runtime_state);

        let canisters_queued_for_upgrade = runtime_state.data.canisters_requiring_upgrade.count_pending();
        info!(%version, canisters_queued_for_upgrade, "Notifications canister wasm upgraded");
        Success
    }
}
