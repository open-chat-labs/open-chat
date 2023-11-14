use crate::guards::caller_is_owner;
use crate::queries::check_replica_up_to_date;
use crate::{read_state, RuntimeState};
use chat_events::Reader;
use ic_cdk_macros::query;
use types::MessagesResponse;
use user_canister::messages_by_message_index::{Response::*, *};

#[query(guard = "caller_is_owner")]
fn messages_by_message_index(args: Args) -> Response {
    read_state(|state| messages_by_message_index_impl(args, state))
}

fn messages_by_message_index_impl(args: Args, state: &RuntimeState) -> Response {
    if let Err(now) = check_replica_up_to_date(args.latest_known_update, state) {
        return ReplicaNotUpToDateV2(now);
    }

    if let Some(chat) = state.data.direct_chats.get(&args.user_id.into()) {
        let my_user_id = state.env.canister_id().into();
        let events_reader = chat.events.main_events_reader();
        let messages: Vec<_> = args
            .messages
            .into_iter()
            .filter_map(|m| events_reader.message_event(m.into(), Some(my_user_id)))
            .collect();
        let latest_event_index = events_reader.latest_event_index().unwrap();
        let chat_last_updated = chat.last_updated();

        Success(MessagesResponse {
            messages,
            latest_event_index,
            chat_last_updated,
        })
    } else {
        ChatNotFound
    }
}
