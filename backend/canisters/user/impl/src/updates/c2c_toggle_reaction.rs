use crate::model::direct_chat::DirectChat;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use chat_events::ToggleReactionResult;
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

        let exists = chat.events.reaction_exists(caller, None, args.message_id, &args.reaction);

        if exists == args.added {
            return if args.added { Added } else { Removed };
        }

        match chat
            .events
            .toggle_reaction(caller, None, args.message_id, args.reaction.clone(), now)
        {
            ToggleReactionResult::Added(_) => {
                if let Some((recipients, notification)) = build_notification(args, chat, now) {
                    runtime_state.push_notification(recipients, notification);
                }
                Added
            }
            ToggleReactionResult::Removed(_) => Removed,
            ToggleReactionResult::MessageNotFound => MessageNotFound,
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

    chat.events.get(None).and_then(|e| {
        e.get_message_index(message_id)
            .and_then(|m| e.message_by_message_index(m, None))
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
    })
}
