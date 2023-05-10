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
    let participant = match runtime_state.data.participants.get(caller) {
        None => return CallerNotInGroup,
        Some(p) => p,
    };

    if let Some(min_visible_event_index) = runtime_state.data.min_visible_event_index(caller) {
        let now = runtime_state.env.now();

        if let Some(events_reader) =
            runtime_state
                .data
                .events
                .events_reader(min_visible_event_index, args.thread_root_message_index, now)
        {
            if let Some(message) = events_reader.message_internal(args.message_id.into()) {
                if let Some(deleted_by) = &message.deleted_by {
                    if matches!(message.content, MessageContentInternal::Deleted(_)) {
                        return MessageHardDeleted;
                    } else if participant.user_id == message.sender
                        || (deleted_by.deleted_by != message.sender
                            && participant.role.can_delete_messages(&runtime_state.data.permissions))
                    {
                        return Success(SuccessResult {
                            content: message.content.hydrate(Some(participant.user_id)),
                        });
                    } else {
                        return NotAuthorized;
                    }
                } else {
                    return MessageNotDeleted;
                }
            }
        }

        MessageNotFound
    } else {
        NotAuthorized
    }
}
