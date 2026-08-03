use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_user_index;
use crate::timer_job_types::DeleteFileReferencesJob;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_timer_jobs::Job;
use canister_tracing_macros::trace;
use constants::OPENCHAT_BOT_USER_ID;
use group_canister::c2c_moderation_hard_delete::*;
use tracing::error;
use types::{Caller, UnitResult};

// Permanently removes the chat-canister copy of a message after an Upheld verdict. For CSAM the
// blob remains pinned in the evidence vault under the retention regime; the file-reference
// release below is ignored by the bucket for quarantined hashes.
#[update(guard = "caller_is_user_index", msgpack = true)]
#[trace]
fn c2c_moderation_hard_delete(args: Args) -> Response {
    execute_update(|state| c2c_moderation_hard_delete_impl(args, state))
}

fn c2c_moderation_hard_delete_impl(args: Args, state: &mut RuntimeState) -> UnitResult {
    let now = state.env.now();

    // Content is only removable once the message is soft-deleted. It may not be: the moderation
    // delete can have been lost, or the message undeleted before its read-gate flag landed.
    // Deleting here (idempotent for an already-deleted message) means a hard delete never
    // reports success while the content is still live.
    let _ = state.data.chat.delete_messages(
        Caller::OCBot(OPENCHAT_BOT_USER_ID),
        args.thread_root_message_index,
        vec![args.message_id],
        true,
        now,
    );

    if let Some((content, _sender)) =
        state
            .data
            .chat
            .events
            .remove_deleted_message_content(args.thread_root_message_index, args.message_id, now)
    {
        let files_to_delete = content.blob_references();
        if !files_to_delete.is_empty() {
            DeleteFileReferencesJob { files: files_to_delete }.execute();
        }
    } else {
        // The message is gone entirely (eg. hard deleted already). Loud because the alternative
        // reading - content which should have been removed and was not - is the serious one.
        error!(message_id = %args.message_id, "Moderation hard delete: message not found");
    }
    handle_activity_notification(state);
    UnitResult::Success
}
