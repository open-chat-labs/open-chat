use crate::updates::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::unpin_message::{Response::*, *};
use ic_cdk_macros::update;
use types::MessageUnpinned;

#[update]
#[trace]
async fn unpin_message(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| unpin_message_impl(args, state))
}

fn unpin_message_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.is_frozen() {
        return ChatFrozen;
    }

    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        if participant.suspended.value {
            return UserSuspended;
        }
        if !participant.role.can_pin_messages(&runtime_state.data.permissions) {
            return NotAuthorized;
        }

        if !runtime_state.data.events.is_message_accessible_by_index(
            participant.min_visible_event_index(),
            None,
            args.message_index,
        ) {
            return MessageNotFound;
        }

        if let Ok(index) = runtime_state.data.pinned_messages.binary_search(&args.message_index) {
            let now = runtime_state.env.now();

            runtime_state.data.pinned_messages.remove(index);

            let event_index = runtime_state.data.events.push_main_event(
                ChatEventInternal::MessageUnpinned(Box::new(MessageUnpinned {
                    message_index: args.message_index,
                    unpinned_by: participant.user_id,
                    due_to_message_deleted: false,
                })),
                args.correlation_id,
                now,
            );

            handle_activity_notification(runtime_state);

            Success(event_index)
        } else {
            NoChange
        }
    } else {
        CallerNotInGroup
    }
}
