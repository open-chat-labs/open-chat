use crate::updates::handle_activity_notification;
use crate::{RuntimeState, RUNTIME_STATE};
use chat_events::{EditMessageArgs, EditMessageResult};
use cycles_utils::check_cycles_balance;
use group_canister::edit_message::{Response::*, *};
use ic_cdk_macros::update;

#[update]
fn edit_message(args: Args) -> Response {
    check_cycles_balance();

    RUNTIME_STATE.with(|state| edit_message_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn edit_message_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        let now = runtime_state.env.now();
        let sender = participant.user_id;

        let edit_message_args = EditMessageArgs {
            sender,
            message_id: args.message_id,
            content: args.content,
            now,
        };

        match runtime_state.data.events.edit_message(edit_message_args) {
            EditMessageResult::Success => {
                if let Some(replies) = runtime_state.data.replies_map.get(&args.message_id) {
                    // TODO Handle replies in other chats
                    for (_, reply_message_id) in replies.iter().filter(|(chat_id, _)| chat_id.is_none()) {
                        runtime_state.data.events.mark_reply_context_updated(*reply_message_id, now);
                    }
                }
                handle_activity_notification(runtime_state);
                Success
            }
            EditMessageResult::NotAuthorized => MessageNotFound,
            EditMessageResult::NotFound => MessageNotFound,
        }
    } else {
        NotInGroup
    }
}
