use crate::guards::caller_is_group_index;
use crate::updates::c2c_group_index::community_deleted;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use multi_user_canister::c2c_notify_community_deleted::*;

// Superseded by `c2c_group_index`, which carries the same event for every user in the canister at
// once. Kept until the GroupIndex sends that instead.
#[update(guard = "caller_is_group_index", msgpack = true)]
#[trace]
fn c2c_notify_community_deleted(args: Args) -> Response {
    execute_update(|state| c2c_notify_community_deleted_impl(args, state))
}

fn c2c_notify_community_deleted_impl(args: Args, state: &mut RuntimeState) -> Response {
    if let Some(user_index) = state.index_of_local_user(args.user_id) {
        community_deleted(user_index, args.deleted_community, state);
    }
    Response::Success
}
