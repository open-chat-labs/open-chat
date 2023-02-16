use crate::guards::caller_is_group_index_canister;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use local_group_index_canister::c2c_upgrade_group_canister_wasm::{Response::*, *};
use tracing::info;
// use types::CanisterId;

#[update_msgpack(guard = "caller_is_group_index_canister")]
#[trace]
fn c2c_upgrade_group_canister_wasm(args: Args) -> Response {
    mutate_state(|state| c2c_upgrade_group_canister_wasm_impl(args, state))
}

fn c2c_upgrade_group_canister_wasm_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let version = args.wasm.version;

    if !runtime_state.data.test_mode && version < runtime_state.data.group_canister_wasm.version {
        VersionNotHigher
    } else {
        runtime_state.data.canisters_requiring_upgrade.clear();
        runtime_state.data.group_canister_wasm = args.wasm;

        // Temporarily disable group upgrades since groups need to be reinstalled
        // for chat_id in runtime_state
        //     .data
        //     .local_groups
        //     .iter()
        //     .filter(|(_, group)| group.wasm_version != version)
        //     .map(|(chat_id, _)| chat_id)
        // {
        //     runtime_state
        //         .data
        //         .canisters_requiring_upgrade
        //         .enqueue(CanisterId::from(*chat_id))
        // }

        let canisters_queued_for_upgrade = runtime_state.data.canisters_requiring_upgrade.count_pending();
        info!(%version, canisters_queued_for_upgrade, "Group canister wasm upgraded");
        Success
    }
}
