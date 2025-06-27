use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use community_canister::community_events::Args;
use community_canister::community_events::{Response::*, *};
use types::OCResult;

#[query(candid = true, msgpack = true)]
fn community_events(args: Args) -> Response {
    match read_state(|state| events_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn events_impl(args: Args, state: &RuntimeState) -> OCResult<EventsResponse> {
    let events = state.data.events.get_page_events(args);

    Ok(EventsResponse {
        events,
        latest_event_index: state.data.events.latest_event_index(),
        community_last_updated: state.data.details_last_updated(),
    })
}
