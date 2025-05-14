use crate::guards::caller_is_group_index;
use crate::mutate_state;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::c2c_set_max_concurrent_community_upgrades::{Args, Response};
use tracing::info;

#[update(guard = "caller_is_group_index", msgpack = true)]
#[trace]
fn c2c_set_max_concurrent_community_upgrades(args: Args) -> Response {
    mutate_state(|state| {
        state.data.max_concurrent_community_upgrades = args.value;
    });
    info!(args.value, "Max concurrent community upgrades set");
    Response::Success
}
