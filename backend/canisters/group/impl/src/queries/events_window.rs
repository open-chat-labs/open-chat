use crate::{read_state, RuntimeState};
use group_canister::events_window::{Response::*, *};
use group_chat_core::EventsResult;
use ic_cdk_macros::query;

#[query]
fn events_window(args: Args) -> Response {
    read_state(|state| events_window_impl(args, state))
}

fn events_window_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();
    let now = state.env.now();
    let user_id = state.data.lookup_user_id(&caller);

    match state.data.chat.events_window(
        user_id,
        args.thread_root_message_index,
        args.mid_point,
        args.max_messages,
        args.max_events,
        args.latest_client_event_index,
        now,
    ) {
        EventsResult::Success(response) => Success(response),
        EventsResult::UserNotInGroup => CallerNotInGroup,
        EventsResult::ThreadNotFound => ThreadMessageNotFound,
        EventsResult::ReplicaNotUpToDate(event_index) => ReplicaNotUpToDate(event_index),
    }
}
