use crate::guards::caller_is_owner;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::{AddRemoveReactionArgs, NullEventPusher};
use direct_chat::DirectChat;
use oc_error_codes::OCErrorCode;
use types::{EventIndex, MessageId, MessageIndex, OCResult, Reaction, TimestampMillis, UserId};
use user_canister::remove_reaction::*;

#[update(guard = "caller_is_owner", msgpack = true)]
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

    let apply = |chat: &mut DirectChat, thread_root_message_index| {
        apply_reaction(
            chat,
            my_user_id,
            thread_root_message_index,
            message_id,
            reaction.clone(),
            added,
            now,
        )
    };

    let thread_root_message_id = state
        .data
        .users
        .with_user_mut(my_index, |user| {
            user.verify_not_suspended()?;

            let chat = user.direct_chats.get_mut_or_err(&them.into())?;
            apply(chat, thread_root_message_index)?;
            chat.thread_root_message_id(thread_root_message_index)
        })
        .ok_or(OCErrorCode::TargetUserNotFound)??;

    // Then in the other user's copy, where the thread is identified by the id of its root message
    // since message indexes differ between the copies
    // TODO: A user in another canister needs sending `ToggleReaction`, as the User canister does
    state.with_their_direct_chat_mut(my_user_id, them, |chat| {
        if let Ok(thread_root_message_index) = chat.thread_root_message_index(thread_root_message_id) {
            let _ = apply(chat, thread_root_message_index);
        }
    });

    // TODO: When a reaction is added to the other user's message, notify them, record it in their
    // message activity and award them `HadMessageReactedTo`, and award the caller
    // `ReactedToMessage`, as the User canister does
    Ok(())
}

fn apply_reaction(
    chat: &mut DirectChat,
    user_id: UserId,
    thread_root_message_index: Option<MessageIndex>,
    message_id: MessageId,
    reaction: Reaction,
    added: bool,
    now: TimestampMillis,
) -> OCResult {
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
        chat.add_reaction::<NullEventPusher>(args, None).map(|_| ())
    } else {
        chat.remove_reaction(args).map(|_| ())
    }
}
