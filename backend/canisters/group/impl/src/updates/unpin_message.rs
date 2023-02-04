use crate::activity_notifications::handle_activity_notification;
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

        let now = runtime_state.env.now();

        if !runtime_state
            .data
            .events
            .is_accessible(participant.min_visible_event_index(), None, args.message_index.into(), now)
        {
            return MessageNotFound;
        }

        if let Ok(index) = runtime_state.data.pinned_messages.binary_search(&args.message_index) {
            runtime_state.data.pinned_messages.remove(index);

            let push_event_result = runtime_state.data.events.push_main_event(
                ChatEventInternal::MessageUnpinned(Box::new(MessageUnpinned {
                    message_index: args.message_index,
                    unpinned_by: participant.user_id,
                    due_to_message_deleted: false,
                })),
                args.correlation_id,
                now,
            );

            if runtime_state.data.pinned_messages.is_empty() {
                runtime_state.data.date_last_pinned = None;
            }

            handle_activity_notification(runtime_state);

            SuccessV2(push_event_result)
        } else {
            NoChange
        }
    } else {
        CallerNotInGroup
    }
}
