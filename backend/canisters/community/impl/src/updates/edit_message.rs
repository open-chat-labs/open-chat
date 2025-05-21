use crate::{CommunityEventPusher, RuntimeState, activity_notifications::handle_activity_notification, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::EditMessageArgs;
use community_canister::edit_message::*;
use oc_error_codes::OCErrorCode;
use types::{Achievement, OCResult};

#[update(candid = true, msgpack = true)]
#[trace]
fn edit_message(args: Args) -> Response {
    execute_update(|state| edit_message_impl(args, state)).into()
}

fn edit_message_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let member = state.get_calling_member(true)?;
    let now = state.env.now();

    let Some(channel) = state.data.channels.get_mut(&args.channel_id) else {
        return Err(OCErrorCode::ChatNotFound.into());
    };

    let sender = member.user_id;
    let channel_member = channel.chat.members.get_verified_member(sender)?;

    channel.chat.events.edit_message(
        EditMessageArgs {
            sender,
            min_visible_event_index: channel_member.min_visible_event_index(),
            thread_root_message_index: args.thread_root_message_index,
            message_id: args.message_id,
            content: args.content.into(),
            block_level_markdown: args.block_level_markdown,
            finalise_bot_message: false,
            now,
        },
        Some(CommunityEventPusher {
            now,
            rng: state.env.rng(),
            queue: &mut state.data.local_user_index_event_sync_queue,
        }),
    )?;

    if args.new_achievement {
        state.notify_user_of_achievement(sender, Achievement::EditedMessage, now);
    }

    handle_activity_notification(state);
    Ok(())
}
