use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::{AddRemoveReactionArgs, MessageInternal, NullEventPusher, UpdateMessageSuccess};
use direct_chat::DirectChat;
use oc_error_codes::OCErrorCode;
use types::{Chat, EventIndex, MessageId, MessageIndex, OCResult, Reaction, TimestampMillis, UserId};
use user_canister::remove_reaction::*;
use user_canister::{MessageActivity, MessageActivityEvent, ToggleReactionArgs, UserCanisterEvent};
use utils::migrated_user_ids::MigratedUserIds;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn remove_reaction(args: Args) -> Response {
    mutate_state(|state| {
        toggle_reaction(
            args.user_id,
            args.thread_root_message_index,
            args.message_id,
            args.reaction,
            false,
            state,
        )
    })
    .into()
}

// Adds or removes the caller's reaction to a message in their direct chat with `them`, first in the
// caller's copy of the chat and then in the other user's
pub(crate) fn toggle_reaction(
    them: UserId,
    thread_root_message_index: Option<MessageIndex>,
    message_id: MessageId,
    reaction: Reaction,
    added: bool,
    state: &mut RuntimeState,
) -> OCResult {
    if added && !reaction.is_valid() {
        return Err(OCErrorCode::InvalidReaction.into());
    }

    let my_index = state.caller_user_index_or_trap();
    let my_user_id = state.user_id(my_index);
    let now = state.env.now();

    let apply = |chat: &mut DirectChat, thread_root_message_index, migrated_user_ids: &MigratedUserIds| {
        apply_reaction(
            chat,
            my_user_id,
            thread_root_message_index,
            message_id,
            reaction.clone(),
            added,
            now,
            migrated_user_ids,
        )
    };

    let thread_root_message_id = state
        .data
        .users
        .with_user_mut(my_index, |user| {
            user.verify_not_suspended()?;

            let chat = user.direct_chats.get_mut_or_err(&them.into())?;
            apply(chat, thread_root_message_index, &state.data.migrated_user_ids)?;
            chat.thread_root_message_id(thread_root_message_index)
        })
        .ok_or(OCErrorCode::TargetUserNotFound)??;

    // Then in the other user's copy, where the thread is identified by the id of its root message
    // since message indexes differ between the copies. A user in another canister is sent the
    // reaction, along with who it is from for their notification (not needed when it is removed).
    if state.user_index(them).is_none() {
        let (username, display_name, user_avatar_id) = if added {
            state.with_caller_user(|_, user| (user.username.value.clone(), user.display_name.value.clone(), user.avatar.id()))
        } else {
            (String::new(), None, None)
        };
        state.push_user_canister_event(
            my_index,
            them,
            UserCanisterEvent::ToggleReaction(Box::new(ToggleReactionArgs {
                thread_root_message_id,
                message_id,
                reaction: reaction.clone(),
                added,
                username,
                display_name,
                user_avatar_id,
            })),
        );
    }
    let activity = state
        .with_their_direct_chat_mut(my_user_id, them, |chat, migrated_user_ids| {
            let thread_root_message_index = chat.thread_root_message_index(thread_root_message_id).ok()?;
            let result = apply(chat, thread_root_message_index, migrated_user_ids).ok()??;
            let message = result.value;

            // A reaction to their own message generates no activity for them
            (!migrated_user_ids.is_same_user(message.sender, my_user_id)).then(|| MessageActivityEvent {
                chat: Chat::Direct(my_user_id.into()),
                thread_root_message_index,
                message_index: message.message_index,
                message_id: message.message_id,
                event_index: result.event_index,
                activity: MessageActivity::Reaction,
                timestamp: now,
                user_id: Some(my_user_id),
            })
        })
        .flatten();

    if let Some(activity) = activity
        && let Some(their_index) = state.index_of_local_user(them)
    {
        state
            .data
            .users
            .with_user_mut(their_index, |user| user.push_message_activity(activity, now));
    }

    // TODO: When a reaction is added to the other user's message, notify them and award them
    // `HadMessageReactedTo`, and award the caller `ReactedToMessage`, as the User canister does
    Ok(())
}

#[expect(clippy::too_many_arguments)]
pub(crate) fn apply_reaction(
    chat: &mut DirectChat,
    user_id: UserId,
    thread_root_message_index: Option<MessageIndex>,
    message_id: MessageId,
    reaction: Reaction,
    added: bool,
    now: TimestampMillis,
    migrated_user_ids: &MigratedUserIds,
) -> OCResult<Option<UpdateMessageSuccess<MessageInternal>>> {
    let args = AddRemoveReactionArgs {
        user_id,
        min_visible_event_index: EventIndex::default(),
        thread_root_message_index,
        message_id,
        reaction,
        now,
    };
    if added {
        // TODO: Push the reaction to the event store (`UserEventPusher` in the User canister)
        chat.add_reaction::<NullEventPusher>(args, migrated_user_ids, None).map(Some)
    } else {
        chat.remove_reaction(args, migrated_user_ids).map(|_| None)
    }
}
