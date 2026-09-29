use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::mark_message_activity_feed_read::*;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn mark_message_activity_feed_read(args: Args) -> Response {
    execute_update(|state| mark_message_activity_feed_read_impl(args, state))
}

fn mark_message_activity_feed_read_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    state.with_caller_user_mut(|_, user| user.message_activity_events.mark_read_up_to(args.read_up_to, now));
    Response::Success
}
