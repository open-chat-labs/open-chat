use crate::read_state;
use crate::{guards::caller_is_owner, RuntimeState};
use canister_api_macros::query;
use user_canister::message_activity_feed::{Response::*, *};

#[query(guard = "caller_is_owner", candid = true, msgpack = true)]
fn message_activity_feed(args: Args) -> Response {
    read_state(|state| message_activity_feed_impl(args, state))
}

fn message_activity_feed_impl(args: Args, state: &RuntimeState) -> Response {
    let events = state.data.message_activity_events.latest_events(args.since, args.max);
    let total = state.data.message_activity_events.len();

    Success(SuccessResult { events, total })
}
