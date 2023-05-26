use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::Reader;
use group_canister::add_reaction::{Response::*, *};
use group_chat_core::AddRemoveReactionResult;
use ic_cdk_macros::update;
use types::{EventIndex, GroupReactionAddedNotification, Notification, TimestampMillis, UserId};

#[update]
#[trace]
fn add_reaction(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| add_reaction_impl(args, state))
}

fn add_reaction_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return ChatFrozen;
    }

    let caller = state.env.caller();
    if let Some(user_id) = state.data.lookup_user_id(&caller) {
        let now = state.env.now();

        match state.data.chat.add_reaction(
            user_id,
            args.thread_root_message_index,
            args.message_id,
            args.reaction.clone(),
            now,
        ) {
            AddRemoveReactionResult::Success => {
                handle_activity_notification(state);
                handle_notification(args, user_id, now, state);
                Success
            }
            AddRemoveReactionResult::NoChange => NoChange,
            AddRemoveReactionResult::InvalidReaction => InvalidReaction,
            AddRemoveReactionResult::MessageNotFound => MessageNotFound,
            AddRemoveReactionResult::UserNotInGroup => CallerNotInGroup,
            AddRemoveReactionResult::NotAuthorized => NotAuthorized,
            AddRemoveReactionResult::UserSuspended => UserSuspended,
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
    state: &mut RuntimeState,
) {
    if let Some(message) = state
        .data
        .chat
        .events
        .events_reader(EventIndex::default(), thread_root_message_index, now)
        // We pass in `None` in place of `my_user_id` because we don't want to hydrate
        // the notification with data for the current user (eg. their poll votes).
        .and_then(|events_reader| events_reader.message_event(message_id.into(), None))
    {
        if message.event.sender != user_id {
            let notifications_muted = state
                .data
                .chat
                .members
                .get(&message.event.sender)
                .map_or(true, |p| p.notifications_muted.value);

            if !notifications_muted {
                state.push_notification(
                    vec![message.event.sender],
                    Notification::GroupReactionAddedNotification(GroupReactionAddedNotification {
                        chat_id: state.env.canister_id().into(),
                        thread_root_message_index,
                        group_name: state.data.chat.name.clone(),
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
