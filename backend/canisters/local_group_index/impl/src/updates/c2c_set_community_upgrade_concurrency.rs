use crate::guards::caller_is_group_index_canister;
use crate::mutate_state;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_group_index_canister::c2c_set_community_upgrade_concurrency::{Response::*, *};
use std::cmp::min;
use tracing::info;

#[update(guard = "caller_is_group_index_canister", msgpack = true)]
#[trace]
fn c2c_set_community_upgrade_concurrency(args: Args) -> Response {
    mutate_state(|state| {
        let max = state.data.max_concurrent_community_upgrades;
        state.data.community_upgrade_concurrency = min(args.value, max);
        if state.data.community_upgrade_concurrency > 0 {
            crate::jobs::upgrade_communities::start_job_if_required(state);
        }
        info!(state.data.community_upgrade_concurrency, "Community upgrade concurrency set");
        if args.value > max {
            Capped(max)
        } else {
            Success
        }
    })
}
