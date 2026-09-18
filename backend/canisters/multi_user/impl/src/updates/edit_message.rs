use crate::guards::caller_is_owner;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::{EditMessageArgs, NullEventPusher};
use oc_error_codes::OCErrorCode;
use types::{EventIndex, OCResult};
use user_canister::edit_message_v2::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn edit_message_v2(args: Args) -> Response {
    mutate_state(|state| edit_message_impl(args, state)).into()
}

fn edit_message_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let my_index = state.caller_user_index_or_trap();
    let my_user_id = state.user_id(my_index);
    let now = state.env.now();

    let edit_message_args = |sender, thread_root_message_index| EditMessageArgs {
        sender,
        min_visible_event_index: EventIndex::default(),
        thread_root_message_index,
        message_id: args.message_id,
        content: args.content.clone().into(),
        block_level_markdown: args.block_level_markdown,
        og_previews: args.og_previews.clone(),
        finalise_bot_message: false,
        now,
    };

    // Edit the message in the sender's copy of the chat. Unlike the User canister, which passes no
    // thread, this edits messages within threads too.
    let thread_root_message_id = state
        .data
        .users
        .with_user_mut(my_index, |user| {
            user.verify_not_suspended()?;

            if user.blocked_users.contains(&args.user_id) {
                return Err(OCErrorCode::TargetUserBlocked.into());
            }

            let chat = user.direct_chats.get_mut_or_err(&args.user_id.into())?;

            // TODO: Push the edit to the event store (`UserEventPusher` in the User canister)
            chat.edit_message::<NullEventPusher>(edit_message_args(my_user_id, args.thread_root_message_index), None)?;
            chat.thread_root_message_id(args.thread_root_message_index)
        })
        .ok_or(OCErrorCode::TargetUserNotFound)??;

    // Then in the other user's copy, where the thread is identified by the id of its root message
    // since message indexes differ between the copies
    // TODO: A user in another canister needs sending `EditMessage`, as the User canister does
    state.with_their_direct_chat_mut(my_user_id, args.user_id, |chat| {
        if let Ok(thread_root_message_index) = chat.thread_root_message_index(thread_root_message_id) {
            let _ = chat.edit_message::<NullEventPusher>(edit_message_args(my_user_id, thread_root_message_index), None);
        }
    });

    // TODO: Award the `EditedMessage` achievement, as the User canister does
    Ok(())
}
