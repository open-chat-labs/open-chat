use crate::guards::caller_is_governance_principal;
use crate::mutate_state;
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use tracing::info;
use user_index_canister::mark_local_user_index_full::{Response::*, *};

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
fn mark_local_group_index_full(args: Args) -> Response {
    mutate_state(|state| match state.data.local_index_map.get_mut(&args.canister_id) {
        Some(index) => {
            index.mark_full();
            info!(%args.canister_id, "Local user index canister marked full");
            Success
        }
        None => LocalUserIndexNotFound,
    })
}
