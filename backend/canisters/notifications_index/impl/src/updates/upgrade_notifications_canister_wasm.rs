use crate::guards::caller_is_controller;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use notifications_index_canister::upgrade_notifications_canister_wasm::{Response::*, *};
use tracing::info;

#[update(guard = "caller_is_controller")]
#[trace]
fn upgrade_notifications_canister_wasm(args: Args) -> Response {
    mutate_state(|state| upgrade_notifications_canister_wasm_impl(args, state))
}

fn upgrade_notifications_canister_wasm_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let version = args.notifications_canister_wasm.version;

    if !runtime_state.data.test_mode && version < runtime_state.data.notifications_canister_wasm.version {
        VersionNotHigher
    } else {
        runtime_state.data.canisters_requiring_upgrade.clear();
        runtime_state.data.notifications_canister_wasm = args.notifications_canister_wasm;

        for canister_id in runtime_state.data.notifications_canisters.keys() {
            runtime_state.data.canisters_requiring_upgrade.enqueue(*canister_id);
        }

        let canisters_queued_for_upgrade = runtime_state.data.canisters_requiring_upgrade.count_pending();
        info!(%version, canisters_queued_for_upgrade, "Notifications canister wasm upgraded");
        Success
    }
}
