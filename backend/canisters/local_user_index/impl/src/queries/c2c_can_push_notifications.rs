use crate::guards::caller_is_notifications_canister;
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use canister_tracing_macros::trace;
use local_user_index_canister::c2c_can_push_notifications::*;
use types::UserId;

#[query(guard = "caller_is_notifications_canister", msgpack = true)]
#[trace]
fn c2c_can_push_notifications(args: Args) -> Response {
    read_state(|state| c2c_can_push_notifications_impl(args, state))
}

fn c2c_can_push_notifications_impl(args: Args, state: &RuntimeState) -> Response {
    if state.data.local_users.contains(&args.principal.into())
        || state.data.local_groups.contains(&args.principal.into())
        || state.data.local_communities.contains(&args.principal.into())
    {
        Response::Success(true)
    } else {
        Response::Success(false)
    }
}
