use crate::guards::caller_is_hosted_user;
use crate::{MultiUserEventPusher, RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::EditMessageArgs;
use constants::OPENCHAT_BOT_USER_ID;
use oc_error_codes::OCErrorCode;
use types::{Achievement, EventIndex, OCResult};
use user_canister::edit_message_v2::*;
use user_canister::{EditMessageArgs as C2CEditMessageArgs, UserCanisterEvent};

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn edit_message_v2(args: Args) -> Response {
    execute_update(|state| edit_message_impl(args, state)).into()
}

fn edit_message_impl(args: Args, state: &mut RuntimeState) -> OCResult {
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
    let thread_root_message_id = state
        .data
        .users
        .with_user_mut(my_index, |user| {
            user.verify_not_suspended()?;

            if user.blocked_users.contains(&args.user_id) {
                return Err(OCErrorCode::TargetUserBlocked.into());
            }

            let mut chat = user.direct_chats.get_mut_or_err(&args.user_id.into())?;

            chat.edit_message(
                EditMessageArgs {
                    sender: my_user_id,
                    min_visible_event_index: EventIndex::default(),
                    thread_root_message_index: args.thread_root_message_index,
                    message_id: args.message_id,
                    content: args.content.clone().into(),
                    block_level_markdown: args.block_level_markdown,
                    og_previews: args.og_previews.clone(),
                    finalise_bot_message: false,
                    now,
                },
                &state.data.migrated_user_ids,
                Some(event_pusher),
            )?;
            chat.thread_root_message_id(args.thread_root_message_index)
        })
        .ok_or(OCErrorCode::TargetUserNotFound)??;

    // Then in the other user's copy, where the thread is identified by the id of its root message
    // since message indexes differ between the copies
    state.send_user_canister_event(
        my_index,
        args.user_id,
        UserCanisterEvent::EditMessage(Box::new(C2CEditMessageArgs {
            thread_root_message_id,
            message_id: args.message_id,
            content: args.content.into(),
            block_level_markdown: args.block_level_markdown,
            og_previews: args.og_previews,
        })),
    );

    // As in the User canister, which doesn't award it for the chat with the OpenChat bot
    if args.user_id != OPENCHAT_BOT_USER_ID {
        state.award_achievement_and_notify(my_index, Achievement::EditedMessage, now);
    }
    Ok(())
}
