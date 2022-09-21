use crate::updates::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::ToggleReactionResult;
use group_canister::toggle_reaction::{Response::*, *};
use ic_cdk_macros::update;
use types::{GroupReactionAddedNotification, Notification, TimestampMillis, UserId};

#[update]
#[trace]
fn toggle_reaction(args: Args) -> Response {
    run_regular_jobs();

    if args.reaction.is_valid() {
        mutate_state(|state| toggle_reaction_impl(args, state))
    } else {
        InvalidReaction
    }
}

fn toggle_reaction_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        let now = runtime_state.env.now();
        let user_id = participant.user_id;

        if !participant.role.can_react_to_messages(&runtime_state.data.permissions) {
            return NotAuthorized;
        }

        if !runtime_state.data.events.is_message_accessible_by_id(
            participant.min_visible_event_index(),
            args.thread_root_message_index,
            args.message_id,
        ) {
            return MessageNotFound;
        }

        let (event_index, added) = match runtime_state.data.events.toggle_reaction(
            user_id,
            args.thread_root_message_index,
            args.message_id,
            args.reaction.clone(),
            now,
        ) {
            ToggleReactionResult::Added(e) => (e, true),
            ToggleReactionResult::Removed(e) => (e, false),
            ToggleReactionResult::MessageNotFound => return MessageNotFound,
        };

        handle_activity_notification(runtime_state);

        if added {
            handle_notification(args, user_id, now, runtime_state);
            Added(event_index)
        } else {
            Removed(event_index)
        }
    } else {
        CallerNotInGroup
    }
}

fn handle_notification(
    Args {
        thread_root_message_index,
        message_id,
        reaction,
        username,
    }: Args,
    user_id: UserId,
    now: TimestampMillis,
    runtime_state: &mut RuntimeState,
) {
    if let Some(message) = runtime_state.data.events.get(thread_root_message_index).and_then(|e| {
        e.get_message_index(message_id)
            // We pass in `None` in place of `my_user_id` because we don't want to hydrate
            // the notification with data for the current user (eg. their poll votes).
            .and_then(|m| e.message_by_message_index(m, None))
    }) {
        if message.event.sender != user_id {
            let notifications_muted = runtime_state
                .data
                .participants
                .get_by_user_id(&message.event.sender)
                .map_or(true, |p| p.notifications_muted.value);

            if !notifications_muted {
                runtime_state.push_notification(
                    vec![message.event.sender],
                    Notification::GroupReactionAddedNotification(GroupReactionAddedNotification {
                        chat_id: runtime_state.env.canister_id().into(),
                        thread_root_message_index,
                        group_name: runtime_state.data.name.clone(),
                        added_by: user_id,
                        added_by_name: username,
                        message,
                        reaction,
                        timestamp: now,
                    }),
                );
            }
        }
    }
}
