use crate::guards::caller_is_owner;
use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::query;
use user_canister::events_range::{Response::*, *};

#[query(guard = "caller_is_owner")]
fn events_range(args: Args) -> Response {
    RUNTIME_STATE.with(|state| events_range_impl(args, state.borrow().as_ref().unwrap()))
}

fn events_range_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    if let Some(chat) = runtime_state.data.direct_chats.get(&args.user_id.into()) {
        let events = chat.events.get_range(args.from_index, args.to_index);
        let affected_events = chat.events.affected_events(&events);

        Success(SuccessResult { events, affected_events })
    } else {
        ChatNotFound
    }
}
