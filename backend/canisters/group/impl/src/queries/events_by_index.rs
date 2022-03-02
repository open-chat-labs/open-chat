use crate::{read_state, RuntimeState};
use group_canister::events_by_index::{Response::*, *};
use ic_cdk_macros::query;
use types::EventIndex;

#[query]
fn events_by_index(args: Args) -> Response {
    read_state(|state| events_by_index_impl(args, state))
}

fn events_by_index_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(min_visible_event_index) = runtime_state.data.min_visible_event_index(caller) {
        let mut event_indexes = args.events;
        if min_visible_event_index > EventIndex::default() {
            event_indexes.retain(|e| *e >= min_visible_event_index);
        }

        let user_id = runtime_state.data.participants.get(caller).map(|p| p.user_id);
        let events = runtime_state.data.events.get_by_index(event_indexes, user_id);
        let affected_events = runtime_state.data.events.affected_events(&events, user_id);
        let latest_event_index = runtime_state.data.events.last().index;

        Success(SuccessResult {
            events,
            affected_events,
            latest_event_index,
        })
    } else {
        CallerNotInGroup
    }
}
