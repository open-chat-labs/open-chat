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
    if let Some(min_visible_event_index) = runtime_state.data.min_visible_event_index(caller, args.invite_code) {
        let mut from_index = args.from_index;

        let chat_events = if let Some(thread_message_index) = args.thread_root_message_index {
            if let Some(thread_events) = runtime_state.data.threads.get(&thread_message_index) {
                thread_events
            } else {
                return ThreadMessageNotFound;
            }
        } else {
            from_index = max(args.from_index, min_visible_event_index);
            &runtime_state.data.events
        };

        let user_id = runtime_state.data.participants.get(caller).map(|p| p.user_id);
        let events = chat_events.get_range(from_index, args.to_index, user_id);
        let affected_events = chat_events.affected_events(&events, user_id);
        let latest_event_index = chat_events.last().index;

        Success(SuccessResult {
            events,
            affected_events,
            latest_event_index,
        })
    } else {
        CallerNotInGroup
    }
}
