use crate::{read_state, RuntimeState};
use group_canister::messages_by_message_index::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn messages_by_message_index(args: Args) -> Response {
    read_state(|state| messages_by_message_index_impl(args, state))
}

fn messages_by_message_index_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(min_visible_event_index) = runtime_state.data.min_visible_event_index(caller, args.invite_code) {
        if let Some((chat_events, min_visible_event_index)) = runtime_state
            .data
            .events
            .get_with_min_visible_event_index(args.thread_root_message_index, min_visible_event_index)
        {
            let user_id = runtime_state.data.participants.get(caller).map(|p| p.user_id);

            let messages: Vec<_> = args
                .messages
                .into_iter()
                .filter_map(|m| chat_events.message_by_message_index(m, user_id))
                .filter(|m| m.index >= min_visible_event_index)
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
