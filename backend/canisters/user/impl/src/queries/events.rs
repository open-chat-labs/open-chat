use crate::guards::caller_is_owner;
use crate::{read_state, RuntimeState};
use ic_cdk_macros::query;
use types::EventIndex;
use user_canister::events::{Response::*, *};

#[query(guard = "caller_is_owner")]
fn events(args: Args) -> Response {
    read_state(|state| events_impl(args, state))
}

fn events_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    if let Some(chat) = runtime_state.data.direct_chats.get(&args.user_id.into()) {
        let my_user_id = runtime_state.env.canister_id().into();

        let events = chat.events.from_index(
            args.start_index,
            args.ascending,
            args.max_events as usize,
            EventIndex::default(),
            Some(my_user_id),
        );

        let affected_events = chat.events.affected_events(&events, Some(my_user_id));

        Success(SuccessResult { events, affected_events })
    } else {
        ChatNotFound
    }
}
