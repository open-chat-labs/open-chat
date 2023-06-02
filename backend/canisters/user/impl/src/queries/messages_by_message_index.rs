use crate::guards::caller_is_owner;
use crate::{read_state, RuntimeState};
use chat_events::Reader;
use ic_cdk_macros::query;
use user_canister::messages_by_message_index::{Response::*, *};

#[query(guard = "caller_is_owner")]
fn messages_by_message_index(args: Args) -> Response {
    read_state(|state| messages_by_message_index_impl(args, state))
}

fn messages_by_message_index_impl(args: Args, state: &RuntimeState) -> Response {
    if let Some(chat) = state.data.direct_chats.get(&args.user_id.into()) {
        let my_user_id = state.env.canister_id().into();
        let now = state.env.now();

        let events_reader = chat.events.main_events_reader(now);
        let latest_event_index = events_reader.latest_event_index().unwrap();

        let messages: Vec<_> = args
            .messages
            .into_iter()
            .filter_map(|m| events_reader.message_event(m.into(), Some(my_user_id)))
            .collect();

        Success(SuccessResult {
            messages,
            latest_event_index,
        })
    } else {
        ChatNotFound
    }
}
