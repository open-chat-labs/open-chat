use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::query;
use types::EventIndex;
use user_canister::events_window::{Response::*, *};

#[query]
fn events_window(args: Args) -> Response {
    RUNTIME_STATE.with(|state| events_window_impl(args, state.borrow().as_ref().unwrap()))
}

fn events_window_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    runtime_state.trap_if_caller_not_owner();

    if let Some(chat) = runtime_state.data.direct_chats.get(&args.user_id.into()) {
        let events = chat.events.get_events_window(
            args.mid_point,
            args.max_messages as usize,
            args.max_events as usize,
            EventIndex::default(),
        );

        let affected_events = chat.events.affected_events(&events);

        Success(SuccessResult { events, affected_events })
    } else {
        ChatNotFound
    }
}
