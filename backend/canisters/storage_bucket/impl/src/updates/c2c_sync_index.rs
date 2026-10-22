use crate::model::files::RemoveFileResult;
use crate::{MAX_EVENTS_TO_SYNC_PER_BATCH, RuntimeState};
use candid::Principal;
use storage_index_canister::StorageBucketEvent;
use types::{AccessorId, FileId, FileRemoved};

// A run of the sync events the StorageIndex sends, gathered by kind
#[derive(Default)]
pub(crate) struct SyncArgs {
    pub users_added: Vec<Principal>,
    pub users_removed: Vec<Principal>,
    pub accessors_removed: Vec<AccessorId>,
    pub files_to_remove: Vec<FileId>,
}

// Returns the files removed, up to the number synced in one batch, the rest being queued as events
pub(crate) fn c2c_sync_index_impl(args: SyncArgs, state: &mut RuntimeState) -> Vec<FileRemoved> {
    for user_id in args.users_added {
        state.data.users.add(user_id);
    }

    let mut files_removed: Vec<FileRemoved> = Vec::new();

    for user_id in args.users_removed {
        if let Some(user) = state.data.users.remove(&user_id) {
            for file_id in user.files_owned() {
                if let RemoveFileResult::Success(b) = state.data.files.remove(user_id, file_id) {
                    files_removed.push(b)
                }
            }
        }
    }

    // Deleted groups and communities can have many files, so they are removed in the background
    state.data.files.queue_accessor_removals(args.accessors_removed);
    crate::jobs::remove_accessors::start_job_if_required(state);

    for file_id in args.files_to_remove {
        if let RemoveFileResult::Success(file_removed) = state.data.files.remove_unchecked(file_id) {
            files_removed.push(file_removed);
        }
    }

    if files_removed.len() > MAX_EVENTS_TO_SYNC_PER_BATCH {
        // If there are too many events to sync in a single batch, queue the excess events to be
        // synced later via heartbeat
        let excess = files_removed.split_off(MAX_EVENTS_TO_SYNC_PER_BATCH);

        for removed in excess {
            state.push_event_to_index(StorageBucketEvent::FileRemoved(removed));
        }
    }

    crate::jobs::remove_expired_files::start_job_if_required(state);

    files_removed
}
