use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::query;
use user_canister::events::{Response::*, *};

#[query]
fn events(args: Args) -> Response {
    RUNTIME_STATE.with(|state| events_impl(args, state.borrow().as_ref().unwrap()))
}

fn events_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    runtime_state.trap_if_caller_not_owner();

    if let Some(chat) = runtime_state.data.direct_chats.get(&args.user_id.into()) {
        let events = chat
            .events
            .from_index(args.start_index, args.ascending, args.max_messages, args.max_events);

        let affected_events = chat.events.affected_events(&events);

        Success(SuccessResult { events, affected_events })
    } else {
        ChatNotFound
    }
}
