use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_user_index;
use crate::{CommunityEventPusher, RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::{MessageContentInternal, TextContentInternal};
use community_canister::c2c_send_moderation_report::*;
use constants::OPENCHAT_BOT_USER_ID;
use oc_error_codes::OCErrorCode;
use rand::Rng;
use types::{Caller, OCResult};

#[update(guard = "caller_is_user_index", msgpack = true)]
#[trace]
fn c2c_send_moderation_report(args: Args) -> Response {
    execute_update(|state| c2c_send_moderation_report_impl(args, state)).into()
}

fn c2c_send_moderation_report_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let now = state.env.now();
    let message_id = state.env.rng().r#gen::<u128>().into();

    let channel = state
        .data
        .channels
        .get_mut(&args.channel_id)
        .ok_or(OCErrorCode::ChatNotFound)?;

    channel.chat.send_message(
        &Caller::OCBot(OPENCHAT_BOT_USER_ID),
        None,
        message_id,
        MessageContentInternal::Text(TextContentInternal { text: args.text }),
        None,
        &[],
        false,
        None,
        false,
        false,
        CommunityEventPusher {
            now,
            rng: state.env.rng(),
            queue: &mut state.data.local_user_index_event_sync_queue,
        },
        true,
        Vec::new(),
        now,
    )?;

    handle_activity_notification(state);
    Ok(())
}
