use crate::guards::caller_is_controller;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use group_index_canister::set_max_concurrent_canister_upgrades::{Response::*, *};
use ic_cdk_macros::update;
use tracing::info;

#[update(guard = "caller_is_controller")]
#[trace]
async fn set_max_concurrent_canister_upgrades(args: Args) -> Response {
    mutate_state(|state| set_max_concurrent_canister_upgrades_impl(args, state))
}

fn set_max_concurrent_canister_upgrades_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.data.max_concurrent_canister_upgrades = args.value;
    info!("Max concurrent canister upgrades set to {}", args.value);
    Success
}
