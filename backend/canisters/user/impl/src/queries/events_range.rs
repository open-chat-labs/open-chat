use crate::guards::caller_is_owner;
use crate::{read_state, RuntimeState};
use ic_cdk_macros::query;
use user_canister::events_range::{Response::*, *};

#[query(guard = "caller_is_owner")]
fn events_range(args: Args) -> Response {
    read_state(|state| events_range_impl(args, state))
}

fn events_range_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    if let Some(chat) = runtime_state.data.direct_chats.get(&args.user_id.into()) {
        let my_user_id = runtime_state.env.canister_id().into();

        let events = chat
            .events
            .get_range(args.from_index, args.to_index, Some(my_user_id));
        let affected_events = chat.events.affected_events(&events, Some(my_user_id));

        Success(SuccessResult { events, affected_events })
    } else {
        ChatNotFound
    }
}
