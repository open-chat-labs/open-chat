use crate::guards::caller_is_governance_principal;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use group_index_canister::upgrade_local_group_index_canister_wasm::{Response::*, *};
use tracing::info;

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
fn upgrade_local_group_index_canister_wasm(args: Args) -> Response {
    mutate_state(|state| upgrade_local_group_index_canister_wasm_impl(args, state))
}

fn upgrade_local_group_index_canister_wasm_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let version = args.wasm.version;

    if !runtime_state.data.test_mode && version < runtime_state.data.local_group_index_canister_wasm_for_new_canisters.version {
        VersionNotHigher
    } else {
        runtime_state.data.canisters_requiring_upgrade.clear();
        if args.use_for_new_canisters.unwrap_or(true) {
            runtime_state.data.local_group_index_canister_wasm_for_new_canisters = args.wasm.clone();
        }
        runtime_state.data.local_group_index_canister_wasm_for_upgrades = args.wasm;

        for canister_id in runtime_state
            .data
            .local_index_map
            .iter()
            .filter(|(_, i)| i.wasm_version() != version)
            .map(|(c, _)| c)
            .filter(|&c| args.include.as_ref().map_or(true, |i| i.contains(c)))
            .filter(|&c| args.exclude.as_ref().map_or(true, |e| !e.contains(c)))
        {
            runtime_state.data.canisters_requiring_upgrade.enqueue(*canister_id);
        }
        crate::jobs::upgrade_canisters::start_job_if_required(runtime_state);

        let canisters_queued_for_upgrade = runtime_state.data.canisters_requiring_upgrade.count_pending();
        info!(%version, canisters_queued_for_upgrade, "Local group index canister wasm upgraded");
        Success
    }
}
