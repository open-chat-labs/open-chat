use crate::guards::caller_is_owner;
use crate::{read_state, RuntimeState};
use canister_api_macros::query_candid_and_msgpack;
use user_canister::chit_events::*;

#[query_candid_and_msgpack(guard = "caller_is_owner")]
fn chit_events(args: Args) -> Response {
    read_state(|state| chit_events_impl(args, state))
}

fn chit_events_impl(args: Args, state: &RuntimeState) -> Response {
    let (events, total) = state.data.chit_events.events(args.from, args.max, args.ascending);

    Response::Success(SuccessResult { events, total })
}
