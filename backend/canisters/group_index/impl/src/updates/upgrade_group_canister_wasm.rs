use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use group_index_canister::upgrade_group_canister_wasm::{Response::*, *};
use ic_cdk_macros::update;
use tracing::info;

#[update]
#[trace]
fn upgrade_group_canister_wasm(args: Args) -> Response {
    mutate_state(|state| upgrade_group_canister_wasm_impl(args, state))
}

fn upgrade_group_canister_wasm_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let permitted_callers = &runtime_state.data.service_principals;

    if !permitted_callers.contains(&caller) {
        return NotAuthorized;
    }

    let version = args.group_canister_wasm.version;

    if !runtime_state.data.test_mode && version < runtime_state.data.group_canister_wasm.version {
        VersionNotHigher
    } else {
        runtime_state.data.canisters_requiring_upgrade.clear();
        runtime_state.data.group_canister_wasm = args.group_canister_wasm.decompress();

        for chat_id in runtime_state
            .data
            .public_groups
            .iter()
            .filter(|g| g.wasm_version() != version)
            .map(|g| g.id())
            .chain(
                runtime_state
                    .data
                    .private_groups
                    .iter()
                    .filter(|g| g.wasm_version() != version)
                    .map(|g| g.id()),
            )
        {
            runtime_state.data.canisters_requiring_upgrade.enqueue(chat_id.into());
        }

        let canisters_queued_for_upgrade = runtime_state.data.canisters_requiring_upgrade.count_pending();
        info!(%version, canisters_queued_for_upgrade, "Group canister wasm upgraded");
        Success
    }
}
