use crate::{read_state, RuntimeState};
use group_canister::events::{Response::*, *};
use ic_cdk_macros::query;
use types::EventIndex;

#[query]
fn events(args: Args) -> Response {
    read_state(|state| events_impl(args, state))
}

fn events_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();

    if let Some(min_visible_event_index) = runtime_state.data.min_visible_event_index(caller, args.invite_code) {
        let user_id = runtime_state.data.participants.get(caller).map(|p| p.user_id);
        let mut min_visible_event_index = min_visible_event_index;

        let chat_events = if let Some(thread_message_index) = args.thread_root_message_index {
            if let Some(thread_events) = runtime_state.data.threads.get(&thread_message_index) {
                min_visible_event_index = EventIndex::default();
                thread_events
            } else {
                return ThreadMessageNotFound;
            }
        } else {
            &runtime_state.data.events
        };

        let events = chat_events.from_index(
            args.start_index,
            args.ascending,
            args.max_events as usize,
            min_visible_event_index,
            user_id,
        );

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
