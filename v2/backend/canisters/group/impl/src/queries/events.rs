use crate::{RuntimeState, RUNTIME_STATE};
use group_canister::queries::events::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn events(args: Args) -> Response {
    RUNTIME_STATE.with(|state| events_impl(args, state.borrow().as_ref().unwrap()))
}

fn events_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    if runtime_state.is_caller_participant() {
        let events = runtime_state.data.events.get_range(args.from_index, args.to_index);
        let latest_event_index = runtime_state.data.events.latest_event_index();
        Success(SuccessResult {
            events,
            latest_event_index,
        })
    } else {
        NotInGroup
    }
}
