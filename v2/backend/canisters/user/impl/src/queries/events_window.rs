use crate::guards::caller_is_owner;
use crate::{read_state, RuntimeState};
use ic_cdk_macros::query;
use types::EventIndex;
use user_canister::events_window::{Response::*, *};

#[query(guard = "caller_is_owner")]
fn events_window(args: Args) -> Response {
    read_state(|state| events_window_impl(args, state))
}

fn events_window_impl(args: Args, runtime_state: &RuntimeState) -> Response {
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
