use crate::RuntimeState;
use crate::activity_notifications::handle_activity_notification;
use community_canister::ModerationUndelete as Args;
use oc_error_codes::OCErrorCode;
use types::UnitResult;

pub(crate) fn c2c_moderation_undelete_impl(args: Args, state: &mut RuntimeState) -> UnitResult {
    let now = state.env.now();
    let Some(channel) = state.data.channels.get_mut(&args.channel_id) else {
        return UnitResult::Error(OCErrorCode::ChatNotFound.into());
    };
    channel
        .chat
        .events
        .moderation_undelete(args.thread_root_message_index, args.message_id, now)
        .inspect_err(|error| {
            // Eg. the sender self-deleted before the report so the content was purged at the
            // 5-minute hard delete: the user is unsuspended but the message cannot come back
            tracing::error!(?error, message_id = %args.message_id, "Moderation restore failed");
        })
        .inspect(|_| {
            // Without this, clients never learn the message changed and their cached copy
            // keeps showing the deleted placeholder until local state is cleared
            handle_activity_notification(state);
        })
        .map(|_| ())
        .into()
}
