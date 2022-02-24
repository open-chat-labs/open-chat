use crate::{read_state, RuntimeState};
use group_canister::events_range::{Response::*, *};
use ic_cdk_macros::query;
use std::cmp::max;

#[query]
fn events_range(args: Args) -> Response {
    read_state(|state| events_range_impl(args, state))
}

fn events_range_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get(caller) {
        let min_visible_event_index = participant.min_visible_event_index();
        let from_index = max(args.from_index, min_visible_event_index);

        let events = runtime_state
            .data
            .events
            .get_range(from_index, args.to_index, Some(participant.user_id));
        let affected_events = runtime_state.data.events.affected_events(&events, Some(participant.user_id));
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
