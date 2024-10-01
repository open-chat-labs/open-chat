use crate::guards::caller_is_owner;
use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use chat_events::{MessageContentInternal, Reader};
use user_canister::deleted_message::{Response::*, *};

#[query(guard = "caller_is_owner", candid = true, msgpack = true)]
fn deleted_message(args: Args) -> Response {
    read_state(|state| deleted_message_impl(args, state))
}

fn deleted_message_impl(args: Args, state: &RuntimeState) -> Response {
    let my_user_id = state.env.canister_id().into();

    if let Some(chat) = state.data.direct_chats.get(&args.user_id.into()) {
        let events_reader = chat.events.main_events_reader();

        if let Some(message) = events_reader.message_internal(args.message_id.into()) {
            let deleted_by = message.deleted_by.as_ref().map(|d| d.deleted_by);

            match deleted_by {
                Some(u) if u != my_user_id => NotAuthorized,
                _ => {
                    if matches!(message.content, MessageContentInternal::Deleted(_)) {
                        MessageHardDeleted
                    } else {
                        Success(SuccessResult {
                            content: message.content.hydrate(Some(my_user_id)),
                        })
                    }
                }
            }
        } else {
            MessageNotFound
        }
    } else {
        ChatNotFound
    }
}
