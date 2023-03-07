use crate::MAX_EVENTS_TO_SYNC_PER_BATCH;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use storage_index_canister::c2c_sync_bucket::Args;
use types::{FileAdded, FileRemoved};

// We want to send events to the index in order, so while a sync is in progress we avoid sending
// more events in case the first batch fails and the second succeeds. If a sync fails, the args that
// were sent are stored so that they can be retried again.
#[derive(Serialize, Deserialize, Default)]
pub struct IndexSyncState {
    queue: VecDeque<EventToSync>,
    in_progress: bool,
    args_to_retry: Option<Args>,
}

impl IndexSyncState {
    pub fn enqueue(&mut self, event: EventToSync) {
        self.queue.push_back(event);
    }

    pub fn pop_args_for_next_sync(&mut self, bytes_used: u64, bytes_remaining: i64) -> Option<Args> {
        if self.in_progress {
            None
        } else if let Some(args) = self.args_to_retry.take() {
            self.in_progress = true;
            Some(args)
        } else if self.queue.is_empty() {
            None
        } else {
            let mut args = Args {
                files_added: Vec::new(),
                files_removed: Vec::new(),
                bytes_used,
                bytes_remaining,
            };

            for _ in 0..MAX_EVENTS_TO_SYNC_PER_BATCH {
                if let Some(event) = self.queue.pop_front() {
                    match event {
                        EventToSync::FileAdded(a) => args.files_added.push(a),
                        EventToSync::FileRemoved(r) => args.files_removed.push(r),
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

    pub fn queue_len(&self) -> u32 {
        self.queue.len() as u32
    }
}

#[derive(Serialize, Deserialize)]
pub enum EventToSync {
    FileAdded(FileAdded),
    FileRemoved(FileRemoved),
}
