use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::c2c_bot_update_mini_app::*;
use oc_error_codes::OCErrorCode;
use types::{EventIndex, OCResult};

// A bot changing what its MiniApp card shows as its game goes on
#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_bot_update_mini_app(args: Args) -> Response {
    execute_update(|state| c2c_bot_update_mini_app_impl(args, state)).into()
}

fn c2c_bot_update_mini_app_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    // Any bot installed in the group may update its own cards, without a permission of its own
    if state.data.get_bot_permissions(&args.bot_id).is_none() {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    let new_result = args.update.result.has_update();
    let now = state.env.now();
    state
        .data
        .chat
        .update_mini_app(args.bot_id, args.thread, args.message_id, args.update, now)?;

    // The result is text the bot wrote, classified as an edit's would be
    if new_result
        && state.data.chat.is_public.value
        && let Some((message, _)) =
            state
                .data
                .chat
                .events
                .message_internal(EventIndex::default(), args.thread, args.message_id.into())
    {
        let input = message.content.moderation_input();
        state.queue_message_for_moderation(args.thread, args.message_id, input);
    }

    handle_activity_notification(state);
    Ok(())
}
