use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::mark_message_activity_feed_read::{Response::*, *};

#[update(guard = "caller_is_owner", candid = true, msgpack = true)]
#[trace]
fn mark_message_activity_feed_read(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| mark_message_activity_feed_read_impl(args, state))
}

fn mark_message_activity_feed_read_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    state.data.message_activity_events.mark_read_up_to(args.read_up_to, now);
    Success
}
