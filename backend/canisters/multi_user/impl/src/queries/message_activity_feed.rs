use crate::guards::caller_is_owner;
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use user_canister::message_activity_feed::{Response::*, *};

#[query(guard = "caller_is_owner", msgpack = true)]
fn message_activity_feed(args: Args) -> Response {
    read_state(|state| message_activity_feed_impl(args, state))
}

fn message_activity_feed_impl(args: Args, state: &RuntimeState) -> Response {
    state.with_caller_user(|_, user| {
        let events = user.message_activity_events.latest_events(args.since);
        let total = user.message_activity_events.len();

        Success(SuccessResult { events, total })
    })
}
