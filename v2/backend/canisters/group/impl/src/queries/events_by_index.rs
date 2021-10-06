use crate::{RuntimeState, RUNTIME_STATE};
use group_canister::events_by_index::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn events_by_index(args: Args) -> Response {
    RUNTIME_STATE.with(|state| events_by_index_impl(args, state.borrow().as_ref().unwrap()))
}

fn events_by_index_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        let mut event_indexes = args.events;
        event_indexes.retain(|e| *e >= participant.min_visible_event_index);

        let events = runtime_state.data.events.get_by_index(event_indexes);
        let affected_events = runtime_state.data.events.affected_events(&events);
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
