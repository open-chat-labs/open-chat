use crate::guards::caller_is_controller;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use tracing::info;
use user_index_canister::upgrade_user_canister_wasm::{Response::*, *};

#[update(guard = "caller_is_controller")]
#[trace]
fn upgrade_user_canister_wasm(args: Args) -> Response {
    mutate_state(|state| upgrade_user_canister_wasm_impl(args, state))
}

fn upgrade_user_canister_wasm_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let version = args.user_canister_wasm.version;

    if !runtime_state.data.test_mode && version < runtime_state.data.user_canister_wasm.version {
        VersionNotHigher
    } else {
        runtime_state.data.canisters_requiring_upgrade.clear();
        runtime_state.data.user_canister_wasm = args.user_canister_wasm;

        for user_id in runtime_state
            .data
            .users
            .iter()
            .filter(|u| u.wasm_version != version && !u.is_bot)
            .map(|u| u.user_id)
        {
            runtime_state.data.canisters_requiring_upgrade.enqueue(user_id.into())
        }

        let canisters_queued_for_upgrade = runtime_state.data.canisters_requiring_upgrade.count_pending();
        info!(%version, canisters_queued_for_upgrade, "User canister wasm upgraded");
        Success
    }
}
