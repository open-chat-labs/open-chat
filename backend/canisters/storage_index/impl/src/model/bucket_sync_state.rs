use candid::Principal;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use storage_bucket_canister::c2c_sync_index::Args;
use types::{AccessorId, FileId};

// We want to send events to the each bucket in order, so while a sync is in progress we avoid sending
// more events in case the first batch fails and the second succeeds. If a sync fails, the args that
// were sent are stored so that they can be retried again.
#[derive(Serialize, Deserialize, Default)]
pub struct BucketSyncState {
    queue: VecDeque<EventToSync>,
    in_progress: bool,
    args_to_retry: Option<Args>,
}

impl BucketSyncState {
    pub fn take(&mut self) -> Vec<EventToSync> {
        assert!(!self.in_progress);
        let mut events = Vec::new();
        if let Some(args) = self.args_to_retry.take() {
            for principal in args.users_added {
                events.push(EventToSync::UserAdded(principal));
            }
            for principal in args.users_removed {
                events.push(EventToSync::UserRemoved(principal));
            }
            for principal in args.accessors_removed {
                events.push(EventToSync::AccessorRemoved(principal));
            }
            for (old, new) in args.user_ids_updated {
                events.push(EventToSync::UserIdUpdated(old, new));
            }
            for file_id in args.files_to_remove {
                events.push(EventToSync::FileToRemove(file_id));
            }
        }
        events.extend(std::mem::take(&mut self.queue));
        events
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub enum EventToSync {
    UserAdded(Principal),
    UserRemoved(Principal),
    AccessorRemoved(AccessorId),
    UserIdUpdated(Principal, Principal),
    FileToRemove(FileId),
}
