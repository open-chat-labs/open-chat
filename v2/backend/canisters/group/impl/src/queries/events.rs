use crate::{RuntimeState, RUNTIME_STATE};
use group_canister::events::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn events(args: Args) -> Response {
    RUNTIME_STATE.with(|state| events_impl(args, state.borrow().as_ref().unwrap()))
}

fn events_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        let min_visible_event_index = participant.min_visible_event_index;

        let events = runtime_state.data.events.from_index(
            args.start_index,
            args.ascending,
            args.max_messages as usize,
            args.max_events as usize,
            min_visible_event_index,
        );

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
