use crate::guards::caller_is_owner;
use crate::{read_state, RuntimeState};
use ic_cdk_macros::query;
use types::EventWrapper;
use user_canister::messages_by_message_index::{Response::*, *};

#[query(guard = "caller_is_owner")]
fn messages_by_message_index(args: Args) -> Response {
    read_state(|state| messages_by_message_index_impl(args, state))
}

fn messages_by_message_index_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    if let Some(chat) = runtime_state.data.direct_chats.get(&args.user_id.into()) {
        let my_user_id = runtime_state.env.canister_id().into();

        let messages: Vec<_> = args
            .messages
            .into_iter()
            .filter_map(|m| chat.events.main.message_by_message_index(m))
            .map(|e| EventWrapper {
                index: e.index,
                timestamp: e.timestamp,
                event: chat.events.main.hydrate_message(e.event, Some(my_user_id)),
            })
            .collect();

        let latest_event_index = chat.events.main.last().index;

        Success(SuccessResult {
            messages,
            latest_event_index,
        })
    } else {
        ChatNotFound
    }
}
