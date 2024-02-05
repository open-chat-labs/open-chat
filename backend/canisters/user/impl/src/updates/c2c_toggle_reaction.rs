use crate::model::direct_chat::DirectChat;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use chat_events::{AddRemoveReactionArgs, AddRemoveReactionResult, Reader};
use types::{DirectReactionAddedNotification, EventIndex, Notification, UserId};
use user_canister::c2c_toggle_reaction::{Response::*, *};

#[update_msgpack]
#[trace]
fn c2c_toggle_reaction(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_toggle_reaction_impl(args, state.env.caller().into(), state))
}

pub(crate) fn c2c_toggle_reaction_impl(args: Args, caller_user_id: UserId, state: &mut RuntimeState) -> Response {
    if state.data.blocked_users.contains(&caller_user_id) {
        return UserBlocked;
    } else if !args.reaction.is_valid() {
        return InvalidReaction;
    }

    if let Some(chat) = state.data.direct_chats.get_mut(&caller_user_id.into()) {
        let now = state.env.now();
        let add_remove_reaction_args = AddRemoveReactionArgs {
            user_id: caller_user_id,
            min_visible_event_index: EventIndex::default(),
            thread_root_message_index: None,
            message_id: args.message_id,
            reaction: args.reaction.clone(),
            now,
        };

        if args.added {
            match chat.events.add_reaction(add_remove_reaction_args) {
                AddRemoveReactionResult::Success => {
                    if !state.data.suspended.value {
                        if let Some((recipient, notification)) = build_notification(args, chat) {
                            state.push_notification(recipient, notification);
                        }
                    }
                    Added
                }
                AddRemoveReactionResult::NoChange => Added,
                AddRemoveReactionResult::MessageNotFound => MessageNotFound,
            }
        } else {
            match chat.events.remove_reaction(add_remove_reaction_args) {
                AddRemoveReactionResult::Success | AddRemoveReactionResult::NoChange => Removed,
                AddRemoveReactionResult::MessageNotFound => MessageNotFound,
            }
        }
    } else {
        ChatNotFound
    }
}

fn build_notification(
    Args {
        message_id,
        reaction,
        username,
        display_name,
        user_avatar_id,
        ..
    }: Args,
    chat: &DirectChat,
) -> Option<(UserId, Notification)> {
    if username.is_empty() || chat.notifications_muted.value {
        return None;
    }

    let message_event = chat
        .events
        .main_events_reader()
        .message_event(message_id.into(), None)
        .filter(|m| m.event.sender != chat.them)?;

    Some((
        message_event.event.sender,
        Notification::DirectReactionAdded(DirectReactionAddedNotification {
            them: chat.them,
            thread_root_message_index: None,
            message_index: message_event.event.message_index,
            message_event_index: message_event.index,
            username,
            display_name,
            reaction,
            user_avatar_id,
        }),
    ))
}
