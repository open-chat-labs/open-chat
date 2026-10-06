use crate::guards::caller_is_group_index;
use crate::updates::c2c_delete_group::spawn_uninstall_then_refund_canister;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::c2c_delete_community::*;
use oc_error_codes::OCErrorCode;
use types::OCResult;

#[update(guard = "caller_is_group_index", msgpack = true)]
#[trace]
fn c2c_delete_community(args: Args) -> Response {
    mutate_state(|state| c2c_delete_community_impl(args, state)).into()
}

fn c2c_delete_community_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    if state.data.local_communities.delete(&args.community_id) {
        let canister_id = args.community_id.into();
        // The community is gone, so there is no point sending it the events still queued for it
        state.data.community_event_sync_queue.take(&canister_id);
        spawn_uninstall_then_refund_canister(canister_id);
        Ok(())
    } else {
        Err(OCErrorCode::CommunityNotFound.into())
    }
}
