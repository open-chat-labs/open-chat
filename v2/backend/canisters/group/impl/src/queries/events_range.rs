use crate::{RuntimeState, RUNTIME_STATE};
use group_canister::events_range::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn events_range(args: Args) -> Response {
    RUNTIME_STATE.with(|state| events_range_impl(args, state.borrow().as_ref().unwrap()))
}

fn events_range_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    if runtime_state.is_caller_participant() {
        let events = runtime_state.data.events.get_range(args.from_index, args.to_index);
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
