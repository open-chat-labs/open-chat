use crate::guards::caller_is_notifications_canister;
use crate::{read_state, RuntimeState};
use canister_api_macros::query_msgpack;
use canister_tracing_macros::trace;
use local_user_index_canister::c2c_can_push_notifications::*;
use types::UserId;

#[query_msgpack(guard = "caller_is_notifications_canister")]
#[trace]
fn c2c_can_push_notifications(args: Args) -> Response {
    read_state(|state| c2c_can_push_notifications_impl(args, state))
}

fn c2c_can_push_notifications_impl(args: Args, state: &RuntimeState) -> Response {
    let user_id: UserId = args.principal.into();
    if state.data.local_users.get(&user_id).is_some() {
        Response::Success(true)
    } else {
        Response::Success(false)
    }
}
