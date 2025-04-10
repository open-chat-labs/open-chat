use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::EditMessageArgs;
use constants::OPENCHAT_BOT_USER_ID;
use oc_error_codes::OCErrorCode;
use types::{Achievement, EventIndex, OCResult};
use user_canister::edit_message_v2::{Response::*, *};
use user_canister::UserCanisterEvent;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn edit_message_v2(args: Args) -> Response {
    run_regular_jobs();

    if let Err(error) = mutate_state(|state| edit_message_impl(args, state)) {
        Error(error)
    } else {
        Success
    }
}

fn edit_message_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_suspended()?;

    if state.data.blocked_users.contains(&args.user_id) {
        Err(OCErrorCode::TargetUserBlocked.into())
    } else if let Some(chat) = state.data.direct_chats.get_mut(&args.user_id.into()) {
        let my_user_id = state.env.canister_id().into();
        let now = state.env.now();

        let edit_message_args = EditMessageArgs {
            sender: my_user_id,
            min_visible_event_index: EventIndex::default(),
            thread_root_message_index: None,
            message_id: args.message_id,
            content: args.content.clone().into(),
            block_level_markdown: args.block_level_markdown,
            finalise_bot_message: false,
            now,
        };

        chat.events
            .edit_message(edit_message_args, Some(&mut state.data.event_store_client))?;

        if args.user_id != OPENCHAT_BOT_USER_ID {
            let thread_root_message_id = args.thread_root_message_index.map(|i| chat.main_message_index_to_id(i));

            state.push_user_canister_event(
                args.user_id.into(),
                UserCanisterEvent::EditMessage(Box::new(user_canister::EditMessageArgs {
                    thread_root_message_id,
                    message_id: args.message_id,
                    content: args.content.into(),
                    block_level_markdown: args.block_level_markdown,
                })),
            );

            state.award_achievement_and_notify(Achievement::EditedMessage, now);
        }
        Ok(())
    } else {
        Err(OCErrorCode::ChatNotFound.into())
    }
}
