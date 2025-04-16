use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::add_reaction::*;
use types::{Achievement, Chat, EventIndex, GroupReactionAddedNotification, Notification, OCResult};
use user_canister::{GroupCanisterEvent, MessageActivity, MessageActivityEvent};

#[update(candid = true, msgpack = true)]
#[trace]
fn add_reaction(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| add_reaction_impl(args, state)).into()
}

fn add_reaction_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let user_id = state.get_caller_user_id()?;
    let now = state.env.now();
    let thread_root_message_index = args.thread_root_message_index;

    state.data.chat.add_reaction(
        user_id,
        args.thread_root_message_index,
        args.message_id,
        args.reaction.clone(),
        now,
        &mut state.data.event_store_client,
    )?;

    if let Some((message, event_index)) =
        state
            .data
            .chat
            .events
            .message_internal(EventIndex::default(), thread_root_message_index, args.message_id.into())
    {
        if let Some(sender) = state.data.chat.members.get(&message.sender) {
            if message.sender != user_id && !sender.user_type().is_bot() {
                let chat_id = state.env.canister_id().into();

                let notifications_muted = state
                    .data
                    .chat
                    .members
                    .get(&message.sender)
                    .is_none_or(|p| p.notifications_muted().value || p.suspended().value);

                if !notifications_muted {
                    state.push_notification(
                        Some(user_id),
                        vec![message.sender],
                        Notification::GroupReactionAdded(GroupReactionAddedNotification {
                            chat_id,
                            thread_root_message_index,
                            message_index: message.message_index,
                            message_event_index: event_index,
                            group_name: state.data.chat.name.value.clone(),
                            added_by: user_id,
                            added_by_name: args.username,
                            added_by_display_name: args.display_name,
                            reaction: args.reaction,
                            group_avatar_id: state.data.chat.avatar.as_ref().map(|d| d.id),
                        }),
                    );
                }

                state.push_event_to_user(
                    message.sender,
                    GroupCanisterEvent::MessageActivity(MessageActivityEvent {
                        chat: Chat::Group(chat_id),
                        thread_root_message_index,
                        message_index: message.message_index,
                        message_id: message.message_id,
                        event_index,
                        activity: MessageActivity::Reaction,
                        timestamp: state.env.now(),
                        user_id: Some(user_id),
                    }),
                    now,
                );

                state.notify_user_of_achievement(message.sender, Achievement::HadMessageReactedTo, now);
            }
        }

        if args.new_achievement {
            state.notify_user_of_achievement(user_id, Achievement::ReactedToMessage, now);
        }
    }

    handle_activity_notification(state);
    Ok(())
}
