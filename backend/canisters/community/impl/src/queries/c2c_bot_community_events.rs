use std::collections::HashSet;

use crate::RuntimeState;
use crate::guards::caller_is_local_user_index;
use crate::read_state;
use canister_api_macros::query;
use community_canister::{c2c_bot_community_events::*, community_events::EventsResponse};
use oc_error_codes::OCErrorCode;
use types::OCResult;

#[query(guard = "caller_is_local_user_index", msgpack = true)]
fn c2c_bot_community_events(args: Args) -> Response {
    match read_state(|state| c2c_bot_community_events_impl(args, state)) {
        Ok(details) => Response::Success(details),
        Err(error) => Response::Error(error),
    }
}

fn c2c_bot_community_events_impl(args: Args, state: &RuntimeState) -> OCResult<EventsResponse> {
    let Some(bot) = state.data.bots.get(&args.bot_id) else {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    };

    let permitted_categories = bot
        .autonomous_permissions
        .as_ref()
        .map_or(HashSet::default(), |f| f.permitted_community_event_categories_to_read());

    if permitted_categories.is_empty() {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    let resp = match args.selection_criteria {
        EventsSelectionCriteria::Page(page_args) => state.data.events.get_page_events(page_args, &permitted_categories),
        EventsSelectionCriteria::ByIndex(index_args) => {
            state.data.events.get_by_indexes(&index_args.events, &permitted_categories)
        }
    };

    Ok(EventsResponse {
        events: resp.events,
        unauthorized: resp.unauthorized,
        latest_event_index: resp.latest_event_index,
        community_last_updated: state.data.details_last_updated(),
    })
}
