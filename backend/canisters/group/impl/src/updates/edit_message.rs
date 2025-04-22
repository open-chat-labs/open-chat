use crate::activity_notifications::handle_activity_notification;
use crate::{RuntimeState, mutate_state, run_regular_jobs};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::EditMessageArgs;
use group_canister::edit_message_v2::*;
use types::{Achievement, OCResult};

#[update(candid = true, msgpack = true)]
#[trace]
fn edit_message_v2(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| edit_message_impl(args, state)).into()
}

fn edit_message_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let member = state.get_calling_member(true)?;
    let now = state.env.now();
    let sender = member.user_id();
    let is_bot = member.user_type().is_bot();

    let edit_message_args = EditMessageArgs {
        sender,
        min_visible_event_index: member.min_visible_event_index(),
        thread_root_message_index: args.thread_root_message_index,
        message_id: args.message_id,
        content: args.content.into(),
        block_level_markdown: args.block_level_markdown,
        finalise_bot_message: false,
        now,
    };

    state
        .data
        .chat
        .events
        .edit_message(edit_message_args, Some(&mut state.data.event_store_client))?;

    if args.new_achievement && !is_bot {
        state.notify_user_of_achievement(sender, Achievement::EditedMessage, now);
    }

    handle_activity_notification(state);
    Ok(())
}
