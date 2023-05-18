use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::pin_message_v2::{Response::*, *};
use ic_cdk_macros::update;
use types::MessagePinned;

#[update]
#[trace]
fn pin_message_v2(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| pin_message_impl(args, state))
}

fn pin_message_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.is_frozen() {
        return ChatFrozen;
    }

    let caller = runtime_state.env.caller();
    if let Some(member) = runtime_state.data.get_member(caller) {
        if member.suspended.value {
            return UserSuspended;
        }
        if !member.role.can_pin_messages(&runtime_state.data.group_chat_core.permissions) {
            return NotAuthorized;
        }

        let now = runtime_state.env.now();
        let min_visible_event_index = member.min_visible_event_index();
        let user_id = member.user_id;

        if !runtime_state.data.group_chat_core.events.is_accessible(
            min_visible_event_index,
            None,
            args.message_index.into(),
            now,
        ) {
            return MessageNotFound;
        }

        if let Err(index) = runtime_state
            .data
            .group_chat_core
            .pinned_messages
            .binary_search(&args.message_index)
        {
            runtime_state
                .data
                .group_chat_core
                .pinned_messages
                .insert(index, args.message_index);

            let push_event_result = runtime_state.data.group_chat_core.events.push_main_event(
                ChatEventInternal::MessagePinned(Box::new(MessagePinned {
                    message_index: args.message_index,
                    pinned_by: user_id,
                })),
                args.correlation_id,
                now,
            );

            runtime_state.data.group_chat_core.date_last_pinned = Some(now);

            handle_activity_notification(runtime_state);

            Success(push_event_result)
        } else {
            NoChange
        }
    } else {
        CallerNotInGroup
    }
}
