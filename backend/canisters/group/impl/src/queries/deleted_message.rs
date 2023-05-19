use crate::{read_state, RuntimeState};
use chat_events::Reader;
use group_canister::deleted_message::{Response::*, *};
use ic_cdk_macros::query;
use types::MessageContentInternal;

#[query]
fn deleted_message(args: Args) -> Response {
    read_state(|state| deleted_message_impl(args, state))
}

fn deleted_message_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let member = match runtime_state.data.get_member(caller) {
        None => return CallerNotInGroup,
        Some(p) => p,
    };

    let min_visible_event_index = member.min_visible_event_index();
    let now = runtime_state.env.now();

    if let Some(events_reader) =
        runtime_state
            .data
            .chat
            .events
            .events_reader(min_visible_event_index, args.thread_root_message_index, now)
    {
        if let Some(message) = events_reader.message_internal(args.message_id.into()) {
            return if let Some(deleted_by) = &message.deleted_by {
                if matches!(message.content, MessageContentInternal::Deleted(_)) {
                    MessageHardDeleted
                } else if member.user_id == message.sender
                    || (deleted_by.deleted_by != message.sender
                        && member.role.can_delete_messages(&runtime_state.data.chat.permissions))
                {
                    Success(SuccessResult {
                        content: message.content.hydrate(Some(member.user_id)),
                    })
                } else {
                    NotAuthorized
                }
            } else {
                MessageNotDeleted
            };
        }
    }

    MessageNotFound
}
