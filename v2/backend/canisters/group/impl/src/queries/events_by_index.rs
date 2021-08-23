use crate::{RuntimeState, RUNTIME_STATE};
use group_canister::events_by_index::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn events_by_index(args: Args) -> Response {
    RUNTIME_STATE.with(|state| events_by_index_impl(args, state.borrow().as_ref().unwrap()))
}

fn events_by_index_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    if runtime_state.is_caller_participant() {
        let events = runtime_state.data.events.get_by_index(args.events);
        let latest_event_index = runtime_state.data.events.last().index;
        Success(SuccessResult {
            events,
            latest_event_index,
        })
    } else {
        NotInGroup
    }
}
