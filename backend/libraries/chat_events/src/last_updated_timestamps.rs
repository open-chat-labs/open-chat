use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use types::{EventIndex, MessageIndex, TimestampMillis};

#[derive(Serialize, Deserialize, Default)]
pub struct LastUpdatedTimestamps {
    by_timestamp: BTreeSet<(TimestampMillis, Option<MessageIndex>, EventIndex)>,
    by_event_index: BTreeMap<(Option<MessageIndex>, EventIndex), TimestampMillis>,
}

impl LastUpdatedTimestamps {
    pub fn mark_updated(
        &mut self,
        thread_root_message_index: Option<MessageIndex>,
        event_index: EventIndex,
        now: TimestampMillis,
    ) {
        if let Some(previous) = self.by_event_index.insert((thread_root_message_index, event_index), now) {
            self.by_timestamp.remove(&(previous, thread_root_message_index, event_index));
        }
        self.by_timestamp.insert((now, thread_root_message_index, event_index));
    }

    pub fn iter(&self) -> impl Iterator<Item = (Option<MessageIndex>, EventIndex, TimestampMillis)> + '_ {
        self.by_timestamp.iter().rev().cloned().map(|(ts, r, e)| (r, e, ts))
    }
}
