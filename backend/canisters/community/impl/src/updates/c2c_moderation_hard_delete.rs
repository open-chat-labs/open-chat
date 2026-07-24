use crate::guards::caller_is_user_index;
use crate::timer_job_types::DeleteFileReferencesJob;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_timer_jobs::Job;
use canister_tracing_macros::trace;
use community_canister::c2c_moderation_hard_delete::*;
use types::UnitResult;

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
    if let Some(channel) = state.data.channels.get_mut(&args.channel_id)
        && let Some((content, _sender)) =
            channel
                .chat
                .events
                .remove_deleted_message_content(args.thread_root_message_index, args.message_id, now)
    {
        let files_to_delete = content.blob_references();
        if !files_to_delete.is_empty() {
            DeleteFileReferencesJob { files: files_to_delete }.execute();
        }
    }
    // Idempotent: already-hard-deleted (or never-existed) is success
    UnitResult::Success
}
