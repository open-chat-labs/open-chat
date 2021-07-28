use crate::{RuntimeState, RUNTIME_STATE};
use group_canister::queries::messages_by_index::{Response::*, *};
use ic_cdk_macros::query;

#[query]
fn messages_by_index(args: Args) -> Response {
    RUNTIME_STATE.with(|state| messages_by_index_impl(args, state.borrow().as_ref().unwrap()))
}

fn messages_by_index_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    if runtime_state.is_caller_participant() {
        let chat_messages = &runtime_state.data.messages;

        let messages = chat_messages
            .get_by_index(args.messages)
            .into_iter()
            .map(|m| chat_messages.hydrate_message(m))
            .collect();

        Success(SuccessResult { messages })
    } else {
        NotAuthorised
    }
}
