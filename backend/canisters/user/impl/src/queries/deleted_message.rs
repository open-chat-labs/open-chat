use crate::guards::caller_is_owner;
use crate::{read_state, RuntimeState};
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
        let chat_events = chat.events.main();

        if let Some(message) = chat_events.message_internal_by_message_id(args.message_id) {
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
