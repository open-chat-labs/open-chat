use crate::guards::caller_is_group_index_canister;
use crate::mutate_state;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::c2c_set_max_concurrent_group_upgrades::{Args, Response};
use tracing::info;

#[update(guard = "caller_is_group_index_canister", msgpack = true)]
#[trace]
fn c2c_set_max_concurrent_group_upgrades(args: Args) -> Response {
    mutate_state(|state| {
        state.data.max_concurrent_group_upgrades = args.value;
    });
    info!(args.value, "Max concurrent group upgrades set");
    Response::Success
}
