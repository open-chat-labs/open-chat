use crate::guards::caller_is_hosted_user;
use crate::{MultiUserEventPusher, RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::AddRemoveReactionArgs;
use oc_error_codes::OCErrorCode;
use types::{EventIndex, MessageId, MessageIndex, OCResult, Reaction, UserId};
use user_canister::remove_reaction::*;
use user_canister::{ToggleReactionArgs, UserCanisterEvent};

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn remove_reaction(args: Args) -> Response {
    execute_update(|state| {
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

    let event_pusher = MultiUserEventPusher {
        user_id: my_user_id,
        now,
        rng: state.env.rng(),
        queue: &mut state.data.local_user_index_event_sync_queue,
    };
    let (thread_root_message_id, username, display_name, user_avatar_id) = state
        .data
        .users
        .with_user_mut(my_index, |user| {
            user.verify_not_suspended()?;

            let mut chat = user.direct_chats.get_mut_or_err(&them.into())?;
            let args = AddRemoveReactionArgs {
                user_id: my_user_id,
                min_visible_event_index: EventIndex::default(),
                thread_root_message_index,
                message_id,
                reaction: reaction.clone(),
                now,
            };
            let migrated_user_ids = &state.data.migrated_user_ids;
            if added {
                chat.add_reaction(args, migrated_user_ids, Some(event_pusher))?;
            } else {
                chat.remove_reaction(args, migrated_user_ids)?;
            }
            let thread_root_message_id = chat.thread_root_message_id(thread_root_message_index)?;

            // Who the reaction is from, for the other user's notification, which there is none of
            // when it is removed
            OCResult::Ok(if added {
                (
                    thread_root_message_id,
                    user.username.value.clone(),
                    user.display_name.value.clone(),
                    user.avatar.id(),
                )
            } else {
                (thread_root_message_id, String::new(), None, None)
            })
        })
        .ok_or(OCErrorCode::TargetUserNotFound)??;

    // Then in the other user's copy, where the thread is identified by the id of its root message
    // since message indexes differ between the copies
    state.send_user_canister_event(
        my_index,
        them,
        UserCanisterEvent::ToggleReaction(Box::new(ToggleReactionArgs {
            thread_root_message_id,
            message_id,
            reaction,
            added,
            username,
            display_name,
            user_avatar_id,
        })),
    );
    Ok(())
}
