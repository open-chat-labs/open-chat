use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::c2c_update_mini_app::*;
use oc_error_codes::OCErrorCode;
use types::{EventIndex, MiniAppStatus, OCResult};

// The MiniApp service writing a card's game, through the LocalUserIndex, which only takes it from the
// service
#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_update_mini_app(args: Args) -> Response {
    execute_update(|state| c2c_update_mini_app_impl(args, state)).into()
}

fn c2c_update_mini_app_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let Some(channel) = state.data.channels.get_mut(&args.channel_id) else {
        return Err(OCErrorCode::ChatNotFound.into());
    };

    // Uninstalling the card's bot ends its game. The service learns of it from this, then writes the
    // game as finished, which is let through so the card doesn't look like it's still being played
    let (message, _) = channel
        .chat
        .events
        .message_internal(EventIndex::default(), args.thread, args.message_id.into())
        .ok_or(OCErrorCode::MessageNotFound)?;
    if args.update.status != MiniAppStatus::Finished && state.data.bots.get(&message.sender).is_none() {
        return Err(OCErrorCode::BotNotFound.into());
    }

    // A finished game's card never changes, so a result is only ever written once
    let new_result = args.update.result.is_some();
    let now = state.env.now();
    channel.chat.update_mini_app(args.thread, args.message_id, args.update, now)?;

    // The result is text the bot wrote, classified as an edit's would be
    if new_result
        && state.data.is_public.value
        && let Some(channel) = state.data.channels.get(&args.channel_id)
        && channel.chat.is_public.value
        && let Some((message, _)) =
            channel
                .chat
                .events
                .message_internal(EventIndex::default(), args.thread, args.message_id.into())
    {
        let input = message.content.moderation_input();
        state.queue_message_for_moderation(args.channel_id, args.thread, args.message_id, input);
    }

    handle_activity_notification(state);
    Ok(())
}
