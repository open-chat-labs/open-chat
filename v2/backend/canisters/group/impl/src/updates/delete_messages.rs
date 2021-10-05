use crate::updates::handle_activity_notification;
use crate::{RuntimeState, RUNTIME_STATE};
use chat_events::DeleteMessageResult;
use cycles_utils::check_cycles_balance;
use group_canister::delete_messages::{Response::*, *};
use ic_cdk_macros::update;

#[update]
fn delete_messages(args: Args) -> Response {
    check_cycles_balance();

    RUNTIME_STATE.with(|state| delete_messages_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn delete_messages_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        let now = runtime_state.env.now();

        for message_id in args.message_ids.into_iter() {
            let result = runtime_state.data.events.delete_message(participant.user_id, message_id, now);
            if matches!(result, DeleteMessageResult::Success) {
                // We can remove from 'replies_map' since the message is now deleted
                if let Some(replies) = runtime_state.data.replies_map.remove(&message_id) {
                    // TODO Handle replies in other chats
                    for (_, reply_message_id) in replies.iter().filter(|(chat_id, _)| chat_id.is_none()) {
                        runtime_state.data.events.mark_reply_context_updated(*reply_message_id, now);
                    }
                }
            }
        }

        handle_activity_notification(runtime_state);

        Success
    } else {
        NotInGroup
    }
}
