use crate::guards::caller_is_group_index_canister;
use crate::mutate_state;
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use local_group_index_canister::c2c_set_group_upgrade_concurrency::{Response::*, *};
use std::cmp::min;
use tracing::info;

#[update_msgpack(guard = "caller_is_group_index_canister")]
#[trace]
fn c2c_set_group_upgrade_concurrency(args: Args) -> Response {
    mutate_state(|state| {
        let max = state.data.max_concurrent_group_upgrades;
        state.data.group_upgrade_concurrency = min(args.value, max);
        info!(state.data.group_upgrade_concurrency, "Group upgrade concurrency set");
        if args.value > max {
            Capped(max)
        } else {
            Success
        }
    })
}
