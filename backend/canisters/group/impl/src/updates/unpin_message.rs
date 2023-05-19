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
    if let Some(member) = runtime_state.data.get_member(caller) {
        if member.suspended.value {
            return UserSuspended;
        }
        if !member.role.can_pin_messages(&runtime_state.data.chat.permissions) {
            return NotAuthorized;
        }

        let now = runtime_state.env.now();

        if !runtime_state
            .data
            .chat
            .events
            .is_accessible(member.min_visible_event_index(), None, args.message_index.into(), now)
        {
            return MessageNotFound;
        }

        let user_id = member.user_id;

        if let Ok(index) = runtime_state.data.chat.pinned_messages.binary_search(&args.message_index) {
            runtime_state.data.chat.pinned_messages.remove(index);

            let push_event_result = runtime_state.data.chat.events.push_main_event(
                ChatEventInternal::MessageUnpinned(Box::new(MessageUnpinned {
                    message_index: args.message_index,
                    unpinned_by: user_id,
                    due_to_message_deleted: false,
                })),
                args.correlation_id,
                now,
            );

            if runtime_state.data.chat.pinned_messages.is_empty() {
                runtime_state.data.chat.date_last_pinned = None;
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
