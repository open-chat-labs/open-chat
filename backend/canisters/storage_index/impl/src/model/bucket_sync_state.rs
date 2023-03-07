use crate::MAX_EVENTS_TO_SYNC_PER_BATCH;
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
    pub fn enqueue(&mut self, event: EventToSync) {
        self.queue.push_back(event);
    }

    pub fn pop_args_for_next_sync(&mut self) -> Option<Args> {
        if self.in_progress {
            None
        } else if let Some(args) = self.args_to_retry.take() {
            self.in_progress = true;
            Some(args)
        } else if self.queue.is_empty() {
            None
        } else {
            let mut args = Args {
                users_added: Vec::new(),
                users_removed: Vec::new(),
                accessors_removed: Vec::new(),
                user_ids_updated: Vec::new(),
                files_to_remove: Vec::new(),
            };

            for _ in 0..MAX_EVENTS_TO_SYNC_PER_BATCH {
                if let Some(event) = self.queue.pop_front() {
                    match event {
                        EventToSync::UserAdded(a) => args.users_added.push(a),
                        EventToSync::UserRemoved(r) => args.users_removed.push(r),
                        EventToSync::AccessorRemoved(r) => args.accessors_removed.push(r),
                        EventToSync::UserIdUpdated(old, new) => args.user_ids_updated.push((old, new)),
                        EventToSync::FileToRemove(file_id) => args.files_to_remove.push(file_id),
                    }
                } else {
                    break;
                }
            }
            self.in_progress = true;
            Some(args)
        }
    }

    pub fn mark_sync_completed(&mut self) {
        self.in_progress = false;
    }

    pub fn mark_sync_failed(&mut self, args: Args) {
        self.in_progress = false;
        self.args_to_retry = Some(args);
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
