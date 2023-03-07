use crate::guards::caller_is_owner;
use crate::{read_state, RuntimeState};
use chat_events::Reader;
use ic_cdk_macros::query;
use types::MessageContentInternal;
use user_canister::deleted_message::{Response::*, *};

#[query(guard = "caller_is_owner")]
fn deleted_message(args: Args) -> Response {
    read_state(|state| deleted_message_impl(args, state))
}

fn deleted_message_impl(args: Args, state: &RuntimeState) -> Response {
    let my_user_id = state.env.canister_id().into();

    if let Some(chat) = state.data.direct_chats.get(&args.user_id.into()) {
        let now = state.env.now();
        let events_reader = chat.events.main_events_reader(now);

        if let Some(message) = events_reader.message_internal(args.message_id.into()) {
            if my_user_id != message.sender {
                NotAuthorized
            } else if message.deleted_by.is_none() {
                MessageNotDeleted
            } else if matches!(message.content, MessageContentInternal::Deleted(_)) {
                MessageHardDeleted
            } else {
                Success(SuccessResult {
                    content: message.content.hydrate(Some(my_user_id)),
                })
            }
        } else {
            MessageNotFound
        }
    } else {
        ChatNotFound
    }
}
