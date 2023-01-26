use crate::updates::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::pin_message_v2::{Response::*, *};
use ic_cdk_macros::update;
use types::{EventResult, MessagePinned};

#[update]
#[trace]
fn pin_message(args: Args) -> group_canister::pin_message::Response {
    run_regular_jobs();

    match mutate_state(|state| pin_message_impl(args, state)) {
        Response::CallerNotInGroup => group_canister::pin_message::Response::CallerNotInGroup,
        Response::ChatFrozen => group_canister::pin_message::Response::ChatFrozen,
        Response::MessageIndexOutOfRange => group_canister::pin_message::Response::MessageIndexOutOfRange,
        Response::MessageNotFound => group_canister::pin_message::Response::MessageNotFound,
        Response::NoChange => group_canister::pin_message::Response::NoChange,
        Response::NotAuthorized => group_canister::pin_message::Response::NotAuthorized,
        Response::UserSuspended => group_canister::pin_message::Response::UserSuspended,
        Response::Success(er) => group_canister::pin_message::Response::Success(er.index),
    }
}

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
    if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        if participant.suspended.value {
            return UserSuspended;
        }
        if !participant.role.can_pin_messages(&runtime_state.data.permissions) {
            return NotAuthorized;
        }

        if !runtime_state
            .data
            .events
            .is_accessible(participant.min_visible_event_index(), None, args.message_index.into())
        {
            return MessageNotFound;
        }

        if let Err(index) = runtime_state.data.pinned_messages.binary_search(&args.message_index) {
            let now = runtime_state.env.now();

            runtime_state.data.pinned_messages.insert(index, args.message_index);

            let event_index = runtime_state.data.events.push_main_event(
                ChatEventInternal::MessagePinned(Box::new(MessagePinned {
                    message_index: args.message_index,
                    pinned_by: participant.user_id,
                })),
                args.correlation_id,
                now,
            );

            runtime_state.data.date_last_pinned = Some(now);

            handle_activity_notification(runtime_state);

            Success(EventResult {
                index: event_index,
                timestamp: now,
            })
        } else {
            NoChange
        }
    } else {
        CallerNotInGroup
    }
}
