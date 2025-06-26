use crate::RuntimeState;
use crate::guards::caller_is_local_user_index;
use crate::read_state;
use canister_api_macros::query;
use community_canister::c2c_bot_community_events::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::{BotPermissions, CommunityPermission, OCResult};

#[query(guard = "caller_is_local_user_index", msgpack = true)]
fn c2c_bot_community_events(args: Args) -> Response {
    match read_state(|state| c2c_bot_community_events_impl(args, state)) {
        Ok(details) => Success(details),
        Err(error) => Error(error),
    }
}

fn c2c_bot_community_events_impl(args: Args, state: &RuntimeState) -> OCResult<EventsResponse> {
    if !state.data.is_bot_permitted(
        &args.bot_id,
        None,
        &args.initiator,
        &BotPermissions::from_community_permission(CommunityPermission::ReadEvents),
    ) {
        return Err(OCErrorCode::InitiatorNotFound.into());
    }

    let events = match args.selection_criteria {
        EventsSelectionCriteria::Page(page_args) => state.data.events.get_page_events(page_args),
        EventsSelectionCriteria::ByIndex(index_args) => state.data.events.get_by_indexes(&index_args.events),
    };

    Ok(EventsResponse {
        events,
        latest_event_index: state.data.events.latest_event_index(),
        community_last_updated: state.data.details_last_updated(),
    })
}
