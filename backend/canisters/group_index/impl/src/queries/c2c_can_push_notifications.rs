use crate::guards::caller_is_notifications_canister;
use crate::{read_state, RuntimeState};
use canister_api_macros::query_msgpack;
use canister_tracing_macros::trace;
use group_index_canister::c2c_can_push_notifications::*;
use types::ChatId;

#[query_msgpack(guard = "caller_is_notifications_canister")]
#[trace]
fn c2c_can_push_notifications(args: Args) -> Response {
    read_state(|state| c2c_can_push_notifications_impl(args, state))
}

fn c2c_can_push_notifications_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let chat_id: ChatId = args.principal.into();
    if runtime_state.data.public_groups.get(&chat_id).is_some() || runtime_state.data.private_groups.get(&chat_id).is_some() {
        Response::Success(true)
    } else {
        Response::Success(false)
    }
}
