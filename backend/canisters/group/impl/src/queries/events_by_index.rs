use crate::{read_state, RuntimeState};
use group_canister::events_by_index::{Response::*, *};
use group_chat_core::EventsResult;
use ic_cdk_macros::query;

#[query]
fn events_by_index(args: Args) -> Response {
    read_state(|state| events_by_index_impl(args, state))
}

fn events_by_index_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let now = runtime_state.env.now();
    let user_id = runtime_state.data.lookup_user_id(&caller);

    match runtime_state.data.chat.events_by_index(
        user_id,
        args.thread_root_message_index,
        args.events,
        args.latest_client_event_index,
        now,
    ) {
        EventsResult::Success(response) => Success(response),
        EventsResult::UserNotInGroup => CallerNotInGroup,
        EventsResult::ThreadNotFound => ThreadMessageNotFound,
        EventsResult::ReplicaNotUpToDate(event_index) => ReplicaNotUpToDate(event_index),
    }
}
