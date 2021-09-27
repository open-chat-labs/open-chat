use crate::{RuntimeState, RUNTIME_STATE};
use group_canister::events_range::{Response::*, *};
use ic_cdk_macros::query;
use std::cmp::max;

#[query]
fn events_range(args: Args) -> Response {
    RUNTIME_STATE.with(|state| events_range_impl(args, state.borrow().as_ref().unwrap()))
}

fn events_range_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        let from_index = max(args.from_index, participant.min_visible_event_index);

        let events = runtime_state.data.events.get_range(from_index, args.to_index);
        let affected_events = runtime_state.data.events.affected_events(&events);
        let latest_event_index = runtime_state.data.events.last().index;

        Success(SuccessResult {
            events,
            affected_events,
            latest_event_index,
        })
    } else {
        NotInGroup
    }
}
