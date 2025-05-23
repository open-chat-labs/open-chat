use crate::read_state;
use crate::{RuntimeState, guards::caller_is_owner};
use canister_api_macros::query;
use user_canister::message_activity_feed::{Response::*, *};

#[query(guard = "caller_is_owner", msgpack = true)]
fn message_activity_feed(args: Args) -> Response {
    read_state(|state| message_activity_feed_impl(args, state))
}

fn message_activity_feed_impl(args: Args, state: &RuntimeState) -> Response {
    let events = state.data.message_activity_events.latest_events(args.since);
    let total = state.data.message_activity_events.len();

    Success(SuccessResult { events, total })
}
