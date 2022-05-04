use crate::{read_state, RuntimeState};
use group_canister::events_window::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn events_window(args: Args) -> Response {
    read_state(|state| events_window_impl(args, state))
}

fn events_window_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(min_visible_event_index) = runtime_state.data.min_visible_event_index(caller) {
        let user_id = runtime_state.data.participants.get(caller).map(|p| p.user_id);
        let latest_event_index = runtime_state.data.events.last().index;

        let (events, affected_events) =
            if let Some(mid_point) = runtime_state.data.events.get_event_index_by_message_index(args.mid_point) {
                let events = runtime_state.data.events.get_events_window(
                    mid_point,
                    args.max_messages as usize,
                    args.max_events as usize,
                    min_visible_event_index,
                    user_id,
                );

                let affected_events = runtime_state.data.events.affected_events(&events, user_id);

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
        CallerNotInGroup
    }
}
