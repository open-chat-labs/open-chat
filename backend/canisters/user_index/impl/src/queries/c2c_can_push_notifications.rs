use crate::{read_state, RuntimeState};
use canister_api_macros::query_msgpack;
use canister_tracing_macros::trace;
use user_index_canister::c2c_can_push_notifications::*;

#[query_msgpack]
#[trace]
fn c2c_can_push_notifications(args: Args) -> Response {
    read_state(|state| c2c_can_push_notifications_impl(args, state))
}

fn c2c_can_push_notifications_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    if runtime_state.data.users.get(&args.principal).is_some() {
        Response::Success(true)
    } else {
        Response::Success(false)
    }
}
