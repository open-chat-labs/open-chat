use crate::{read_state, RuntimeState};
use group_canister::messages_by_message_index::{Response::*, *};
use group_chat_core::MessagesResult;
use ic_cdk_macros::query;

#[query]
fn messages_by_message_index(args: Args) -> Response {
    read_state(|state| messages_by_message_index_impl(args, state))
}

fn messages_by_message_index_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();
    let now = state.env.now();
    let user_id = state.data.lookup_user_id(caller);

    match state.data.chat.messages_by_message_index(
        user_id,
        args.thread_root_message_index,
        args.messages,
        args.latest_client_event_index,
        now,
    ) {
        MessagesResult::Success(response) => Success(SuccessResult {
            messages: response.messages,
            latest_event_index: response.latest_event_index,
        }),
        MessagesResult::UserNotInGroup => CallerNotInGroup,
        MessagesResult::ThreadNotFound => ThreadMessageNotFound,
        MessagesResult::ReplicaNotUpToDate(event_index) => ReplicaNotUpToDate(event_index),
    }
}
