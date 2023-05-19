use crate::{read_state, RuntimeState};
use chat_events::Reader;
use group_canister::messages_by_message_index::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn messages_by_message_index(args: Args) -> Response {
    read_state(|state| messages_by_message_index_impl(args, state))
}

fn messages_by_message_index_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();

    if let Some(min_visible_event_index) = runtime_state.data.min_visible_event_index(caller) {
        let now = runtime_state.env.now();

        if let Some(events_reader) =
            runtime_state
                .data
                .chat
                .events
                .events_reader(min_visible_event_index, args.thread_root_message_index, now)
        {
            let latest_event_index = events_reader.latest_event_index().unwrap();

            if args.latest_client_event_index.map_or(false, |e| latest_event_index < e) {
                return ReplicaNotUpToDate(latest_event_index);
            }

            let user_id = runtime_state.data.get_member(caller).map(|m| m.user_id);

            let messages: Vec<_> = args
                .messages
                .into_iter()
                .filter_map(|m| events_reader.message_event(m.into(), user_id))
                .collect();

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
