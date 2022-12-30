use crate::guards::caller_is_controller;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use local_user_index_canister::c2c_notify_user_index_events::{MaxConcurrentCanisterUpgradesChanged, UserIndexEvent};
use tracing::info;
use user_index_canister::set_max_concurrent_user_canister_upgrades::{Response::*, *};

// dfx --identity openchat canister --network ic call user_index set_max_concurrent_user_canister_upgrades '(record { value=N:nat32 })'
#[update(guard = "caller_is_controller")]
#[trace]
async fn set_max_concurrent_user_canister_upgrades(args: Args) -> Response {
    mutate_state(|state| set_max_concurrent_user_canister_upgrades_impl(args, state))
}

fn set_max_concurrent_user_canister_upgrades_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state
        .data
        .push_event_to_all_local_user_indexes(UserIndexEvent::MaxConcurrentCanisterUpgradesChanged(
            MaxConcurrentCanisterUpgradesChanged { value: args.value },
        ));

    info!("Max concurrent canister upgrades set to {}", args.value);
    Success
}
