use crate::{read_state, RuntimeState};
use group_canister::events_window::{Response::*, *};
use ic_cdk_macros::query;
use std::cmp::min;

#[query]
fn events_window(args: Args) -> Response {
    read_state(|state| events_window_impl(args, state))
}

fn events_window_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(min_visible_event_index) = runtime_state.data.min_visible_event_index(caller, args.invite_code) {
        if let Some((chat_events, min_visible_event_index)) = runtime_state
            .data
            .events
            .get_with_min_visible_event_index(args.thread_root_message_index, min_visible_event_index)
        {
            let latest_event_index = chat_events.last().index;

            if args.latest_client_event_index.map_or(false, |e| latest_event_index < e) {
                return ReplicaNotUpToDate(latest_event_index);
            }

            let user_id = runtime_state.data.participants.get(caller).map(|p| p.user_id);

            let latest_message_index = chat_events.latest_message_index().unwrap_or_default();
            let mid_point = min(args.mid_point, latest_message_index);

            let (events, affected_events) = if let Some(event_index) = chat_events.event_index_by_message_index(mid_point) {
                let events =
                    chat_events.get_events_window(event_index, args.max_events as usize, min_visible_event_index, user_id);

                let affected_events = chat_events.affected_events(&events, user_id);

                (events, affected_events)
            } else {
                (Vec::new(), Vec::new())
            };

            Success(SuccessResult {
                events,
                affected_events,
                latest_event_index,
            })
        } else {
            ThreadMessageNotFound
        }
    } else {
        CallerNotInGroup
    }
}
