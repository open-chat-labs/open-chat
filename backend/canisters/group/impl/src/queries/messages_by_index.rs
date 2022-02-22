use crate::{read_state, RuntimeState};
use group_canister::messages_by_index::{Response::*, *};
use ic_cdk_macros::query;
use types::EventWrapper;

#[query]
fn messages_by_index(args: Args) -> Response {
    read_state(|state| messages_by_index_impl(args, state))
}

fn messages_by_index_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(min_visible_event_index) = runtime_state.data.min_visible_event_index(caller) {
        let events = &runtime_state.data.events;

        let messages: Vec<_> = args.messages
            .into_iter()
            .filter_map(|m| events.message_by_index(m))
            .filter(|m| m.index >= min_visible_event_index)
            .map(|e| EventWrapper {
                index: e.index,
                timestamp: e.timestamp,
                event: events.hydrate_message(e.event)
            })
            .collect();

        let latest_event_index = events.last().index;

        Success(SuccessResult { messages, latest_event_index })
    } else {
        CallerNotInGroup
    }
}
