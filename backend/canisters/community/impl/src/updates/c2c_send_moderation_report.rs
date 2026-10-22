use crate::activity_notifications::handle_activity_notification;
use crate::{CommunityEventPusher, RuntimeState};
use chat_events::MessageContentInternal;
use community_canister::SendModerationReport as Args;
use constants::OPENCHAT_BOT_USER_ID;
use oc_error_codes::OCErrorCode;
use types::{Caller, OCResult};

pub(crate) fn c2c_send_moderation_report_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let now = state.env.now();

    let channel = state
        .data
        .channels
        .get_mut(&args.channel_id)
        .ok_or(OCErrorCode::ChatNotFound)?;

    channel.chat.send_message(
        &Caller::OCBot(OPENCHAT_BOT_USER_ID),
        None,
        args.message_id,
        MessageContentInternal::ModerationReport(Box::new(args.report)),
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
