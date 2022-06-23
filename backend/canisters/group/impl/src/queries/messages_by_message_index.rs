use crate::{read_state, RuntimeState};
use group_canister::messages_by_message_index::{Response::*, *};
use ic_cdk_macros::query;
use types::EventWrapper;

#[query]
fn messages_by_message_index(args: Args) -> Response {
    read_state(|state| messages_by_message_index_impl(args, state))
}

fn messages_by_message_index_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get(caller) {
        let min_visible_event_index = participant.min_visible_event_index();

        if let Some((chat_events, min_visible_event_index)) = runtime_state
            .data
            .chat_events(args.thread_root_message_index, min_visible_event_index)
        {
            let messages: Vec<_> = args
                .messages
                .into_iter()
                .filter_map(|m| chat_events.message_by_message_index(m))
                .filter(|m| m.index >= min_visible_event_index)
                .map(|e| EventWrapper {
                    index: e.index,
                    timestamp: e.timestamp,
                    event: chat_events.hydrate_message(e.event, Some(participant.user_id)),
                })
                .collect();

            let latest_event_index = chat_events.last().index;

            Success(SuccessResult {
                messages,
                latest_event_index,
            })
        } else {
            ThreadMessageNotFound
        }
    } else {
        CallerNotInGroup
    }
}
