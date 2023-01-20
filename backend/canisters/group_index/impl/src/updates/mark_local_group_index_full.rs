use crate::guards::caller_is_controller;
use crate::mutate_state;
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use group_index_canister::mark_local_group_index_full::{Response::*, *};
use tracing::info;

#[proposal(guard = "caller_is_controller")]
#[trace]
fn mark_local_group_index_full(args: Args) -> Response {
    mutate_state(|state| match state.data.local_index_map.get_mut(&args.canister_id) {
        Some(index) => {
            index.mark_full();
            info!(%args.canister_id, "Local group index canister marked full");
            Success
        }
        None => LocalGroupIndexNotFound,
    })
}
