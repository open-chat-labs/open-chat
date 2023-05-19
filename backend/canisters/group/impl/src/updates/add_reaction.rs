use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::Reader;
use group_canister::add_reaction::{Response::*, *};
use group_chat_core::AddReactionResult;
use ic_cdk_macros::update;
use types::{EventIndex, GroupReactionAddedNotification, Notification, TimestampMillis, UserId};

#[update]
#[trace]
fn add_reaction(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| add_reaction_impl(args, state))
}

fn add_reaction_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.is_frozen() {
        return ChatFrozen;
    }

    let caller = runtime_state.env.caller();
    if let Some(user_id) = runtime_state.data.principal_to_user_id_map.get(&caller).copied() {
        let now = runtime_state.env.now();

        match runtime_state.data.chat.add_reaction(
            user_id,
            args.thread_root_message_index,
            args.message_id,
            args.reaction.clone(),
            now,
        ) {
            AddReactionResult::Success => {
                handle_activity_notification(runtime_state);
                handle_notification(args, user_id, now, runtime_state);
                Success
            }
            AddReactionResult::NoChange => NoChange,
            AddReactionResult::InvalidReaction => InvalidReaction,
            AddReactionResult::MessageNotFound => MessageNotFound,
            AddReactionResult::UserNotInGroup => CallerNotInGroup,
            AddReactionResult::NotAuthorized => NotAuthorized,
            AddReactionResult::UserSuspended => UserSuspended,
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
        ..
    }: Args,
    user_id: UserId,
    now: TimestampMillis,
    runtime_state: &mut RuntimeState,
) {
    if let Some(message) = runtime_state
        .data
        .chat
        .events
        .events_reader(EventIndex::default(), thread_root_message_index, now)
        // We pass in `None` in place of `my_user_id` because we don't want to hydrate
        // the notification with data for the current user (eg. their poll votes).
        .and_then(|events_reader| events_reader.message_event(message_id.into(), None))
    {
        if message.event.sender != user_id {
            let notifications_muted = runtime_state
                .data
                .chat
                .members
                .get(&message.event.sender)
                .map_or(true, |p| p.notifications_muted.value);

            if !notifications_muted {
                runtime_state.push_notification(
                    vec![message.event.sender],
                    Notification::GroupReactionAddedNotification(GroupReactionAddedNotification {
                        chat_id: runtime_state.env.canister_id().into(),
                        thread_root_message_index,
                        group_name: runtime_state.data.chat.name.clone(),
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
