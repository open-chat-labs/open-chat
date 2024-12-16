use crate::model::index_event_batch::EventToSync;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use storage_index_canister::c2c_sync_bucket::Args;

// We want to send events to the index in order, so while a sync is in progress we avoid sending
// more events in case the first batch fails and the second succeeds. If a sync fails, the args that
// were sent are stored so that they can be retried again.
#[derive(Serialize, Deserialize, Default)]
pub struct IndexSyncState {
    pub queue: VecDeque<EventToSync>,
    pub args_to_retry: Option<Args>,
}
