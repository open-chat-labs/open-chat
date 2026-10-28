use crate::guards::caller_is_hosted_user;
use crate::{MultiUserEventPusher, RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::{EditMessageArgs, MessageEdit};
use constants::OPENCHAT_BOT_USER_ID;
use multi_user_canister::{EditMessageArgs as C2CEditMessageArgs, UserCanisterEvent};
use multi_user_canister::{edit_message_text, edit_message_v2};
use oc_error_codes::OCErrorCode;
use types::{Achievement, EventIndex, OCResult};

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn edit_message_text(args: edit_message_text::Args) -> edit_message_text::Response {
    execute_update(|state| edit_message_text_impl(args, state)).into()
}

// Older clients send the whole content, of which only the text is taken
#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn edit_message_v2(args: edit_message_v2::Args) -> edit_message_v2::Response {
    let args = edit_message_text::Args {
        user_id: args.user_id,
        thread_root_message_index: args.thread_root_message_index,
        message_id: args.message_id,
        text: args.content.text().map(|t| t.to_string()),
        block_level_markdown: args.block_level_markdown,
        og_previews: args.og_previews,
    };
    execute_update(|state| edit_message_text_impl(args, state)).into()
}

fn edit_message_text_impl(args: edit_message_text::Args, state: &mut RuntimeState) -> OCResult {
    let my_index = state.caller_user_index_or_trap();
    let my_user_id = state.user_id(my_index);
    let now = state.env.now();

    let event_pusher = MultiUserEventPusher {
        user_id: my_user_id,
        now,
        rng: state.env.rng(),
        queue: &mut state.data.local_user_index_event_sync_queue,
    };

    // Edit the message in the sender's copy of the chat
    let (thread_root_message_id, content) = state
        .data
        .users
        .with_user_mut(my_index, |user| -> OCResult<_> {
            user.verify_not_suspended()?;

            if user.has_blocked(args.user_id) {
                return Err(OCErrorCode::TargetUserBlocked.into());
            }

            let mut chat = user.direct_chats.get_mut_or_err(&args.user_id.into())?;

            chat.edit_message(
                EditMessageArgs {
                    sender: my_user_id,
                    min_visible_event_index: EventIndex::default(),
                    thread_root_message_index: args.thread_root_message_index,
                    message_id: args.message_id,
                    edit: MessageEdit::Text(args.text),
                    block_level_markdown: args.block_level_markdown,
                    og_previews: args.og_previews.clone(),
                    finalise_bot_message: false,
                    now,
                },
                Some(event_pusher),
            )?;
            let (message, _) = chat
                .message_internal(args.thread_root_message_index, args.message_id.into())
                .ok_or(OCErrorCode::MessageNotFound)?;
            Ok((chat.thread_root_message_id(args.thread_root_message_index)?, message.content))
        })
        .ok_or(OCErrorCode::TargetUserNotFound)??;

    // Then in the other user's copy, where the thread is identified by the id of its root message
    // since message indexes differ between the copies. The whole edited content is sent, from which
    // the other copy takes only the text, as one not yet upgraded would take the whole of it.
    state.send_user_canister_event(
        my_index,
        args.user_id,
        UserCanisterEvent::EditMessage(Box::new(C2CEditMessageArgs {
            thread_root_message_id,
            message_id: args.message_id,
            content: content.hydrate(None),
            block_level_markdown: args.block_level_markdown,
            og_previews: args.og_previews,
        })),
    );

    // Not awarded for the chat with the OpenChat bot
    if args.user_id != OPENCHAT_BOT_USER_ID {
        state.award_achievement_and_notify(my_index, Achievement::EditedMessage, now);
    }
    Ok(())
}
