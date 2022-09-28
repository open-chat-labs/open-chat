use crate::model::direct_chat::DirectChat;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use chat_events::AddRemoveReactionResult;
use types::{DirectReactionAddedNotification, Notification, TimestampMillis, UserId};
use user_canister::c2c_toggle_reaction::{Response::*, *};

#[update_msgpack]
#[trace]
fn c2c_toggle_reaction(args: Args) -> Response {
    run_regular_jobs();

    if args.reaction.is_valid() {
        mutate_state(|state| c2c_toggle_reaction_impl(args, state))
    } else {
        InvalidReaction
    }
}

fn c2c_toggle_reaction_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller: UserId = runtime_state.env.caller().into();

    if runtime_state.data.blocked_users.contains(&caller) {
        return UserBlocked;
    }

    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&caller.into()) {
        let now = runtime_state.env.now();

        if args.added {
            match chat
                .events
                .add_reaction(caller, None, args.message_id, args.reaction.clone(), now)
            {
                AddRemoveReactionResult::Success(_) => {
                    if let Some((recipients, notification)) = build_notification(args, chat, now) {
                        runtime_state.push_notification(recipients, notification);
                    }
                    Added
                }
                AddRemoveReactionResult::NoChange => Added,
                AddRemoveReactionResult::MessageNotFound => MessageNotFound,
            }
        } else {
            match chat
                .events
                .remove_reaction(caller, None, args.message_id, args.reaction.clone(), now)
            {
                AddRemoveReactionResult::Success(_) | AddRemoveReactionResult::NoChange => Removed,
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
        ..
    }: Args,
    chat: &DirectChat,
    now: TimestampMillis,
) -> Option<(Vec<UserId>, Notification)> {
    if username.is_empty() || chat.notifications_muted.value {
        return None;
    }

    chat.events
        .main()
        .message_event_by_message_id(message_id, None)
        .filter(|m| m.event.sender != chat.them)
        .map(|message| {
            (
                vec![message.event.sender],
                Notification::DirectReactionAddedNotification(DirectReactionAddedNotification {
                    them: chat.them,
                    username,
                    message,
                    reaction,
                    timestamp: now,
                }),
            )
        })
}
