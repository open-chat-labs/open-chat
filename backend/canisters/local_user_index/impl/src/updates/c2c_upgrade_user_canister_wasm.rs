use crate::guards::caller_is_user_index_canister;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use local_user_index_canister::c2c_upgrade_user_canister_wasm::{Response::*, *};
use std::collections::HashSet;
use tracing::info;
use types::CanisterId;

#[update_msgpack(guard = "caller_is_user_index_canister")]
#[trace]
fn c2c_upgrade_user_canister_wasm(args: Args) -> Response {
    mutate_state(|state| c2c_upgrade_user_canister_wasm_impl(args, state))
}

fn c2c_upgrade_user_canister_wasm_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let version = args.wasm.version;

    if !runtime_state.data.test_mode && version < runtime_state.data.user_canister_wasm_for_new_canisters.version {
        VersionNotHigher
    } else {
        runtime_state.data.canisters_requiring_upgrade.clear();
        if args.use_for_new_canisters.unwrap_or(true) {
            runtime_state.data.user_canister_wasm_for_new_canisters = args.wasm.clone();
        }
        runtime_state.data.user_canister_wasm_for_upgrades = args.wasm;

        let include: HashSet<_> = args.include.unwrap_or_default().into_iter().collect();
        let include_all = include.is_empty();
        let exclude: HashSet<_> = args.exclude.unwrap_or_default().into_iter().collect();

        for user_id in runtime_state
            .data
            .local_users
            .iter()
            .filter(|(user_id, user)| user.wasm_version != version && !runtime_state.data.global_users.is_bot(user_id))
            .filter(|(&user_id, _)| include_all || include.contains(&user_id.into()))
            .filter(|(&user_id, _)| !exclude.contains(&user_id.into()))
            .map(|(user_id, _)| user_id)
        {
            runtime_state
                .data
                .canisters_requiring_upgrade
                .enqueue(CanisterId::from(*user_id))
        }
        crate::jobs::upgrade_canisters::start_job_if_required(runtime_state);

        let canisters_queued_for_upgrade = runtime_state.data.canisters_requiring_upgrade.count_pending();
        info!(%version, canisters_queued_for_upgrade, "User canister wasm upgraded");
        Success
    }
}
