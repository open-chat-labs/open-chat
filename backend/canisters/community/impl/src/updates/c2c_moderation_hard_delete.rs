use crate::RuntimeState;
use crate::activity_notifications::handle_activity_notification;
use crate::timer_job_types::DeleteFileReferencesJob;
use canister_timer_jobs::Job;
use community_canister::ModerationHardDelete as Args;
use constants::OPENCHAT_BOT_USER_ID;
use tracing::error;
use types::{Caller, UnitResult};

pub(crate) fn c2c_moderation_hard_delete_impl(args: Args, state: &mut RuntimeState) -> UnitResult {
    let now = state.env.now();
    if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
        // Content is only removable once the message is soft-deleted. It may not be: the
        // moderation delete can have been lost, or the message undeleted before its read-gate
        // flag landed. Deleting here (idempotent for an already-deleted message) means a hard
        // delete never reports success while the content is still live.
        let _ = channel.chat.delete_messages(
            Caller::OCBot(OPENCHAT_BOT_USER_ID),
            args.thread_root_message_index,
            vec![args.message_id],
            true,
            now,
        );

        if let Some((content, _sender)) =
            channel
                .chat
                .events
                .remove_deleted_message_content(args.thread_root_message_index, args.message_id, now)
        {
            let files_to_delete = content.blob_references();
            if !files_to_delete.is_empty() {
                DeleteFileReferencesJob { files: files_to_delete }.execute();
            }
        } else {
            // The message is gone entirely (eg. hard deleted already). Loud because the
            // alternative reading - content which should have been removed and was not - is
            // the serious one.
            error!(message_id = %args.message_id, "Moderation hard delete: message not found");
        }
    }
    handle_activity_notification(state);
    UnitResult::Success
}
