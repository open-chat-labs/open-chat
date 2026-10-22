use crate::RuntimeState;
use crate::activity_notifications::handle_activity_notification;
use community_canister::UpdateModerationReportStatus as Args;
use oc_error_codes::OCErrorCode;
use types::OCResult;

pub(crate) fn c2c_update_moderation_report_status_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let channel = state
        .data
        .channels
        .get_mut(&args.channel_id)
        .ok_or(OCErrorCode::ChatNotFound)?;
    let now = state.env.now();

    channel.chat.events.update_moderation_report(
        None,
        args.message_id,
        chat_events::ModerationReportUpdates {
            status: args.status,
            authority_report: args.authority_report,
            auto_sanctioned: args.auto_sanctioned,
            reporters: args.reporters,
        },
        now,
    )?;

    handle_activity_notification(state);
    Ok(())
}
