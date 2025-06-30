use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use community_canister::community_events::Args;
use community_canister::community_events::{Response::*, *};
use group_community_common::Member;
use oc_error_codes::OCErrorCode;
use types::{CommunityEventCategory, OCResult};

#[query(candid = true, msgpack = true)]
fn community_events(args: Args) -> Response {
    match read_state(|state| community_events_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn community_events_impl(args: Args, state: &RuntimeState) -> OCResult<EventsResponse> {
    // Ensure this endpoint is only accessible to community owners
    let caller = state.env.caller();
    if !state.data.members.get_verified_member(caller).is_ok_and(|m| m.is_owner()) {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    let resp = state.data.events.get_page_events(args, &CommunityEventCategory::all());

    Ok(EventsResponse {
        events: resp.events,
        unauthorized: resp.unauthorized,
        latest_event_index: resp.latest_event_index,
        community_last_updated: state.data.details_last_updated(),
    })
}
