use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::Reader;
use group_canister::add_reaction::{Response::*, *};
use group_chat_core::AddRemoveReactionResult;
use types::{Achievement, EventIndex, GroupReactionAddedNotification, Notification, UserId};

#[update(candid = true, msgpack = true)]
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
    if let Some(user_id) = state.data.lookup_user_id(caller) {
        let now = state.env.now();

        match state.data.chat.add_reaction(
            user_id,
            args.thread_root_message_index,
            args.message_id,
            args.reaction.clone(),
            now,
            &mut state.data.event_store_client,
        ) {
            AddRemoveReactionResult::Success(sender) => {
                if args.new_achievement {
                    state.data.achievements.notify_user(
                        user_id,
                        vec![Achievement::ReactedToMessage],
                        &mut state.data.fire_and_forget_handler,
                    );
                }

                state.data.achievements.notify_user(
                    sender,
                    vec![Achievement::HadMessageReactedTo],
                    &mut state.data.fire_and_forget_handler,
                );

                handle_activity_notification(state);
                handle_notification(args, user_id, state);

                Success
            }
            AddRemoveReactionResult::NoChange => NoChange,
            AddRemoveReactionResult::InvalidReaction => InvalidReaction,
            AddRemoveReactionResult::MessageNotFound => MessageNotFound,
            AddRemoveReactionResult::UserNotInGroup => CallerNotInGroup,
            AddRemoveReactionResult::NotAuthorized => NotAuthorized,
            AddRemoveReactionResult::UserSuspended => UserSuspended,
            AddRemoveReactionResult::UserLapsed => UserLapsed,
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
        display_name,
        ..
    }: Args,
    user_id: UserId,
    state: &mut RuntimeState,
) {
    if let Some(message_event) = state
        .data
        .chat
        .events
        .events_reader(EventIndex::default(), thread_root_message_index)
        // We pass in `None` in place of `my_user_id` because we don't want to hydrate
        // the notification with data for the current user (eg. their poll votes).
        .and_then(|events_reader| events_reader.message_event(message_id.into(), None))
    {
        if message_event.event.sender != user_id {
            let notifications_muted = state
                .data
                .chat
                .members
                .get(&message_event.event.sender)
                .map_or(true, |p| p.notifications_muted.value || p.suspended.value);

            if !notifications_muted {
                state.push_notification(
                    vec![message_event.event.sender],
                    Notification::GroupReactionAdded(GroupReactionAddedNotification {
                        chat_id: state.env.canister_id().into(),
                        thread_root_message_index,
                        message_index: message_event.event.message_index,
                        message_event_index: message_event.index,
                        group_name: state.data.chat.name.value.clone(),
                        added_by: user_id,
                        added_by_name: username,
                        added_by_display_name: display_name,
                        reaction,
                        group_avatar_id: state.data.chat.avatar.as_ref().map(|d| d.id),
                    }),
                );
            }
        }
    }
}
